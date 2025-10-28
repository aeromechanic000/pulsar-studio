/**
 * LLM abstraction layer for pulsar-agent-turbo.
 *
 * Provides unified interface for different LLM providers (OpenAI-compatible, Ollama)
 * with support for streaming text generation, structured output, and aliasable configs.
 */

import axios, { AxiosInstance } from 'axios';
import {
  LLMConfig,
  LLMResponse,
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMValidationError
} from '../types/index.js';

/**
 * Extract JSON content from LLM response, handling markdown code blocks.
 */
function extractJsonFromResponse(content: string): string {
  const trimmedContent = content.trim();

  // Check if content is wrapped in markdown code blocks
  if (trimmedContent.startsWith('```json') && trimmedContent.endsWith('```')) {
    // Extract content between ```json and ```
    return trimmedContent.substring(7, trimmedContent.length - 3).trim();
  } else if (trimmedContent.startsWith('```') && trimmedContent.endsWith('```')) {
    // Extract content between ``` and ```
    const firstNewline = trimmedContent.indexOf('\n');
    const lastTripleBackticks = trimmedContent.lastIndexOf('```');
    if (firstNewline !== -1 && lastTripleBackticks !== -1) {
      return trimmedContent.substring(firstNewline + 1, lastTripleBackticks).trim();
    }
  }

  // Return original content if no markdown wrapping found
  return trimmedContent;
}

/**
 * Abstract base class for LLM clients.
 */
abstract class BaseLLMClient {
  protected config: LLMConfig;
  protected client: AxiosInstance;

  constructor(config: LLMConfig) {
    this.config = { ...config };
    // Clamp temperature to [0, 2] range
    this.config.temperature = Math.max(0.0, Math.min(2.0, this.config.temperature));

    this.client = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  abstract generateText(
    prompt: string,
    options?: { stream?: boolean; [key: string]: any }
  ): Promise<string> | AsyncGenerator<string>;

  abstract generateStructured(
    prompt: string,
    schema: Record<string, any>,
    options?: { [key: string]: any }
  ): Promise<Record<string, any>>;

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const maxRetries = 3;
    let lastException: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastException = error;

        if (error.code === 'ECONNABORTED') {
          throw new LLMTimeoutError(`LLM request timed out: ${error.message}`);
        }

        if (error.response) {
          if (error.response.status === 429) {
            throw new LLMRateLimitError(`Rate limit exceeded: ${error.message}`);
          } else {
            throw new LLMError(`HTTP error ${error.response.status}: ${error.message}`);
          }
        }

        if (attempt === maxRetries) {
          throw new LLMError(`Unexpected error: ${error.message}`);
        }

        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastException!;
  }

  close(): void {
    // Axios doesn't need explicit closing in the same way
  }
}

/**
 * Client for OpenAI-compatible APIs.
 */
class OpenAICompatibleClient extends BaseLLMClient {
  constructor(config: LLMConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('API key is required for OpenAI-compatible client');
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
  }

  async generateText(
    prompt: string,
    options: { stream?: boolean; [key: string]: any } = {}
  ): Promise<string> {
    return this.retryWithBackoff(async () => {
      const messages = [{ role: 'user' as const, content: prompt }];

      const payload: any = {
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
      };

      if (this.config.maxTokens) {
        payload.max_tokens = this.config.maxTokens;
      }

      if (options.stream) {
        payload.stream = true;
      }

      const response = await this.client.post(
        `${this.config.baseUrl}/chat/completions`,
        payload
      );

      return this.handleResponse(response.data);
    });
  }

  async *generateTextStream(
    prompt: string,
    options: { [key: string]: any } = {}
  ): AsyncGenerator<string> {
    const messages = [{ role: 'user' as const, content: prompt }];

    const payload: any = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      stream: true,
    };

    if (this.config.maxTokens) {
      payload.max_tokens = this.config.maxTokens;
    }

    const response = await this.client.post(
      `${this.config.baseUrl}/chat/completions`,
      payload,
      {
        responseType: 'stream',
      }
    );

    const stream = response.data;

    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6);
          if (dataStr.trim() === '[DONE]') {
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            if (data.choices && data.choices[0]) {
              const delta = data.choices[0].delta || {};
              if (delta.content) {
                yield delta.content;
              }
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    }
  }

  async generateStructured(
    prompt: string,
    schema: Record<string, any>,
    options: { [key: string]: any } = {}
  ): Promise<Record<string, any>> {
    return this.retryWithBackoff(async () => {
      const schemaInstruction = (
        `Respond with a valid JSON object that conforms to this schema:\n` +
        `${JSON.stringify(schema, null, 2)}\n\n` +
        `Do not include any text outside the JSON object.`
      );

      const messages = [
        { role: 'system' as const, content: schemaInstruction },
        { role: 'user' as const, content: prompt },
      ];

      const payload: any = {
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
      };

      if (this.config.maxTokens) {
        payload.max_tokens = this.config.maxTokens;
      }

      const response = await this.client.post(
        `${this.config.baseUrl}/chat/completions`,
        payload
      );

      const data = response.data;
      const content = data.choices[0].message.content;

      try {
        return JSON.parse(content);
      } catch (e) {
        throw new LLMValidationError(`Failed to parse JSON response: ${e}`);
      }
    });
  }

  private handleResponse(data: any): string {
    const choice = data.choices[0];
    return choice.message.content;
  }
}

/**
 * Client for Ollama models.
 */
class OllamaClient extends BaseLLMClient {
  constructor(config: LLMConfig) {
    super(config);
  }

  async generateText(
    prompt: string,
    options: { stream?: boolean; [key: string]: any } = {}
  ): Promise<string> {
    return this.retryWithBackoff(async () => {
      const payload: any = {
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
        },
      };

      if (this.config.think) {
        payload.think = true;
      }

      if (this.config.maxTokens) {
        payload.options.num_predict = this.config.maxTokens;
      }

      const response = await this.client.post(
        `${this.config.baseUrl}/api/generate`,
        payload
      );

      return this.handleResponse(response.data);
    });
  }

  async *generateTextStream(
    prompt: string,
    options: { [key: string]: any } = {}
  ): AsyncGenerator<string> {
    const payload: any = {
      model: this.config.model,
      prompt,
      stream: true,
      options: {
        temperature: this.config.temperature,
      },
    };

    if (this.config.think) {
      payload.think = true;
    }

    if (this.config.maxTokens) {
      payload.options.num_predict = this.config.maxTokens;
    }

    const response = await this.client.post(
      `${this.config.baseUrl}/api/generate`,
      payload,
      {
        responseType: 'stream',
      }
    );

    const stream = response.data;

    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
            if (data.done) {
              return;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
    }
  }

  async generateStructured(
    prompt: string,
    schema: Record<string, any>,
    options: { [key: string]: any } = {}
  ): Promise<Record<string, any>> {
    return this.retryWithBackoff(async () => {
      const schemaInstruction = (
        `Respond with a valid JSON object that conforms to this schema:\n` +
        `${JSON.stringify(schema, null, 2)}\n\n` +
        `Your response must be valid JSON only, no additional text.`
      );

      const fullPrompt = `${schemaInstruction}\n\n${prompt}`;

      const payload: any = {
        model: this.config.model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
        },
      };

      if (this.config.think) {
        payload.think = true;
      }

      if (this.config.maxTokens) {
        payload.options.num_predict = this.config.maxTokens;
      }

      const response = await this.client.post(
        `${this.config.baseUrl}/api/generate`,
        payload
      );

      const data = response.data;
      const content = data.response.trim();

      try {
        const jsonContent = extractJsonFromResponse(content);
        return JSON.parse(jsonContent);
      } catch (e) {
        throw new LLMValidationError(`Failed to parse JSON response: ${e}\nResponse content: ${content}`);
      }
    });
  }

  private handleResponse(data: any): string {
    return data.response;
  }
}

/**
 * Unified interface for multiple LLM providers with aliasable configs.
 */
export class LLM {
  private configs: Map<string, LLMConfig> = new Map();
  private clients: Map<string, BaseLLMClient> = new Map();

  addConfig(config: LLMConfig): void {
    /** Add a new LLM configuration. */
    const alias = config.alias || `${config.provider}_${config.model}`;
    this.configs.set(alias, config);

    // Create client instance
    let client: BaseLLMClient;
    if (config.provider === 'openai') {
      client = new OpenAICompatibleClient(config);
    } else if (config.provider === 'ollama') {
      client = new OllamaClient(config);
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }

    this.clients.set(alias, client);
  }

  async generateText(
    prompt: string,
    options: { alias?: string; stream?: boolean; [key: string]: any } = {}
  ): Promise<string | AsyncGenerator<string>> {
    /** Generate text response; supports streaming. */
    if (this.configs.size === 0) {
      throw new Error('No LLM configurations available');
    }

    // Use provided alias or first available config
    const configAlias = options.alias || this.configs.keys().next().value;

    if (!this.clients.has(configAlias)) {
      throw new Error(`No configuration found for alias: ${configAlias}`);
    }

    const client = this.clients.get(configAlias)!;

    // Handle think parameter degradation
    if (client.config.think && !this.supportsThink(client.config.provider, client.config.model)) {
      // Degrade to normal generation
      const originalThink = client.config.think;
      client.config.think = false;
      try {
        if (options.stream) {
          if (client instanceof OllamaClient) {
            return client.generateTextStream(prompt, options);
          } else if (client instanceof OpenAICompatibleClient) {
            return client.generateTextStream(prompt, options);
          }
        }
        return client.generateText(prompt, options);
      } finally {
        client.config.think = originalThink;
      }
    } else {
      if (options.stream) {
        if (client instanceof OllamaClient) {
          return client.generateTextStream(prompt, options);
        } else if (client instanceof OpenAICompatibleClient) {
          return client.generateTextStream(prompt, options);
        }
      }
      return client.generateText(prompt, options);
    }

    // Fallback for TypeScript
    return client.generateText(prompt, options);
  }

  async generateStructured(
    prompt: string,
    schema: Record<string, any>,
    options: { alias?: string; [key: string]: any } = {}
  ): Promise<Record<string, any>> {
    /** Generate structured output (JSON schema enforced); non-streaming. */
    if (this.configs.size === 0) {
      throw new Error('No LLM configurations available');
    }

    // Use provided alias or first available config
    const configAlias = options.alias || this.configs.keys().next().value;

    if (!this.clients.has(configAlias)) {
      throw new Error(`No configuration found for alias: ${configAlias}`);
    }

    const client = this.clients.get(configAlias)!;
    return client.generateStructured(prompt, schema, options);
  }

  private supportsThink(provider: string, model: string): boolean {
    /** Check if the provider/model combination supports thinking. */
    const thinkModels = ['qwen2.5-coder', 'qwen3', 'deepseek-r1'];
    return thinkModels.some(thinkModel => model.toLowerCase().includes(thinkModel));
  }

  closeAll(): void {
    /** Close all client connections. */
    for (const client of this.clients.values()) {
      client.close();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    // Make the class async iterable if needed
    yield '';
  }
}

export * from '../types/index.js';