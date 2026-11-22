import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 600, margin: '40px auto' }}>
          <h2 style={{ color: '#dc2626' }}>Recovered from UI Error</h2>
          <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
            {String(this.state.error.message || this.state.error)}
          </pre>
          <button
            onClick={() => { localStorage.removeItem('token'); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Reset Session & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
