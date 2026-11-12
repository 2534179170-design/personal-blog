"""为站主在本机引导创建单仓库 GitHub 应用。密钥仅写入本机忽略目录，供同步至托管服务。"""
import argparse
import html
import json
import secrets
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", required=True)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--owner-id", required=True)
    parser.add_argument("--repo", default="personal-blog")
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    nonce = secrets.token_urlsafe(24)
    directory = Path(".local")
    directory.mkdir(exist_ok=True)
    result_file = directory / "login-config.json"
    if result_file.exists():
        raise SystemExit("登录配置已存在。")
    manifest = {"name": "Wind Journal " + args.owner_id, "url": origin, "public": False,
                "hook_attributes": {"active": False}, "callback_urls": [origin + "/api/callback"],
                "default_permissions": {"contents": "write"}, "default_events": [],
                "description": "为个人博客验证站主身份并发布文字和照片。"}
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass
        def page(self, body):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control","no-store")
            self.end_headers()
            self.wfile.write(('<!doctype html><meta charset=utf-8><title>小站登录配置</title>'+body).encode())
        def do_GET(self):
            path = urllib.parse.urlparse(self.path)
            values = urllib.parse.parse_qs(path.query)
            if path.path == "/start/"+nonce:
                self.page('<h2>创建小站专用的 GitHub 应用</h2><p>下一页由 GitHub 确认创建。完成后请选择仅安装在个人博客仓库。</p><form method="post" action="https://github.com/settings/apps/new?state='+nonce+'"><input type="hidden" name="manifest" value="'+html.escape(json.dumps(manifest),quote=True)+'"><button>前往 GitHub 创建博客登录应用</button></form>')
            elif path.path == "/finish" and values.get("state") == [nonce] and values.get("code"):
                code = urllib.parse.quote(values["code"][0],safe="")
                req=urllib.request.Request("https://api.github.com/app-manifests/"+code+"/conversions",method="POST",headers={"User-Agent":"wind-journal"})
                with urllib.request.urlopen(req,timeout=25) as resp:
                    data=json.load(resp)
                config={"GH_CLIENT_ID":data["client_id"],"GH_CLIENT_SECRET":data["client_secret"],
                        "SESSION_KEY":secrets.token_urlsafe(32),"BLOG_OWNER_ID":args.owner_id,
                        "BLOG_REPO":args.owner+"/"+args.repo}
                result_file.write_text(json.dumps(config),encoding="utf8")
                url=data["html_url"]+"/installations/new"
                self.page('<h2>博客登录应用已创建</h2><p>最后选择 Only select repositories（仅选择指定仓库），勾选 '+html.escape(args.repo)+'。</p><a href="'+html.escape(url)+'">安装到博客仓库</a>')
                print("应用已创建，请完成单仓库安装。",flush=True)
                self.server.finished=True
            else:
                self.send_error(404)
    with HTTPServer(("127.0.0.1",0),Handler) as server:
        local="http://127.0.0.1:"+str(server.server_port)
        manifest["redirect_url"]=local+"/finish"
        server.finished=False
        print("请在浏览器完成博客应用配置",local+"/start/"+nonce,flush=True)
        webbrowser.open(local+"/start/"+nonce)
        while not server.finished:
            server.handle_request()
if __name__ == "__main__":
    main()
