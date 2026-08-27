import { Component } from 'react';

/**
 * جلوی سفید/سیاه شدن کل صفحه را می‌گیرد.
 * هر خطای زمان اجرا در زیرشاخه‌ها گرفته می‌شود، روی صفحه نمایش داده می‌شود
 * و برای دیباگ به سرور توسعه هم گزارش می‌شود.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const payload = {
      type: 'react-error',
      scope: this.props.scope || 'app',
      message: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n'),
      componentStack: String(info?.componentStack || '').split('\n').slice(0, 6).join('\n'),
    };
    // eslint-disable-next-line no-console
    console.error('[TPT]', payload);
    try {
      fetch('/__client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch (e) { /* noop */ }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.silent) return this.props.fallback ?? null;

    return (
      this.props.fallback ?? (
        <div className="runtime-error" role="alert">
          <strong>صحنه سه‌بعدی اجرا نشد</strong>
          <p>{String(error?.message || error)}</p>
          <small>
            اگر مرورگر شما WebGL را غیرفعال کرده یا شتاب‌دهنده سخت‌افزاری خاموش است،
            این پیام نمایش داده می‌شود. بقیه صفحه سالم است.
          </small>
        </div>
      )
    );
  }
}
