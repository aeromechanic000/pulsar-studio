const app = () => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="
        width: 100vw;
        height: 100vh;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        font-family: system-ui, sans-serif;
      ">
        <h1 style="color: #333; margin: 0 0 20px 0;">Hello World!</h1>
        <p style="color: #666; margin: 0;">Pulsar Studio is working!</p>
      </div>
    `;
  }
};

app();