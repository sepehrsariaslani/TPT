#!/usr/bin/env python3
"""سرور استاتیک ساده با غیرفعال‌سازی کش، برای دیدن آنی تغییرات."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass

if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 3000), NoCache).serve_forever()
