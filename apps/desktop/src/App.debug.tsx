console.log('Test file loaded');

const root = document.getElementById('root');
if (root) {
  console.log('Root element found:', root);
  root.innerHTML = '<div style="color: red; font-size: 24px;">React Test Working!</div>';
} else {
  console.error('Root element not found');
}