//! A tiny HTTP server with canned replies, for testing providers without the network. It
//! records every request so tests can check what was sent.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

#[derive(Debug, Clone)]
pub struct Reply {
    pub status: u16,
    pub content_type: &'static str,
    pub chunks: Vec<String>,
    /// Pause before each chunk, to make streaming observable.
    pub delay: Duration,
}

impl Reply {
    pub fn json(v: Value) -> Self {
        Self { status: 200, content_type: "application/json", chunks: vec![v.to_string()], delay: Duration::ZERO }
    }

    pub fn status(status: u16, body: Value) -> Self {
        Self { status, ..Self::json(body) }
    }

    pub fn sse(events: Vec<String>) -> Self {
        Self { status: 200, content_type: "text/event-stream", chunks: events, delay: Duration::ZERO }
    }

    pub fn with_delay(mut self, delay: Duration) -> Self {
        self.delay = delay;
        self
    }

    /// An OpenAI-compatible stream that writes `pieces` and stops.
    pub fn openai_stream(pieces: &[&str]) -> Self {
        let mut events: Vec<String> = pieces
            .iter()
            .map(|p| format!("data: {}\n\n", json!({ "choices": [{ "index": 0, "delta": { "content": p } }] })))
            .collect();
        events.push(format!(
            "data: {}\n\n",
            json!({ "choices": [{ "index": 0, "delta": {}, "finish_reason": "stop" }] })
        ));
        events.push("data: [DONE]\n\n".into());
        Self::sse(events)
    }

    /// An Anthropic Messages stream that writes `pieces` and ends with `stop_reason`.
    pub fn anthropic_stream(pieces: &[&str], stop_reason: &str) -> Self {
        let ev = |name: &str, data: Value| format!("event: {name}\ndata: {data}\n\n");
        let mut events = vec![
            ev("message_start", json!({ "type": "message_start", "message": { "id": "msg_1", "content": [] } })),
            ev(
                "content_block_start",
                json!({ "type": "content_block_start", "index": 0, "content_block": { "type": "thinking", "thinking": "" } }),
            ),
            ev("content_block_stop", json!({ "type": "content_block_stop", "index": 0 })),
            ev(
                "content_block_start",
                json!({ "type": "content_block_start", "index": 1, "content_block": { "type": "text", "text": "" } }),
            ),
        ];
        events.extend(pieces.iter().map(|p| {
            ev(
                "content_block_delta",
                json!({ "type": "content_block_delta", "index": 1, "delta": { "type": "text_delta", "text": p } }),
            )
        }));
        let mut delta = json!({ "type": "message_delta", "delta": { "stop_reason": stop_reason } });
        if stop_reason == "refusal" {
            delta["delta"]["stop_details"] = json!({ "type": "refusal", "category": "cyber" });
        }
        events.push(ev("content_block_stop", json!({ "type": "content_block_stop", "index": 1 })));
        events.push(ev("message_delta", delta));
        events.push(ev("message_stop", json!({ "type": "message_stop" })));
        Self::sse(events)
    }
}

#[derive(Debug, Clone)]
pub struct Recorded {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl Recorded {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.as_str())
    }

    pub fn json(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or(Value::Null)
    }
}

struct Route {
    method: String,
    path: String,
    /// Replies in order; the last one repeats.
    replies: Vec<Reply>,
}

#[derive(Clone)]
pub struct MockServer {
    pub url: String,
    routes: Arc<Mutex<Vec<Route>>>,
    requests: Arc<Mutex<Vec<Recorded>>>,
}

impl MockServer {
    /// Starts listening on a free local port. Needs a Tokio runtime.
    pub async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let url = format!("http://{}", listener.local_addr().expect("addr"));
        let server = Self { url, routes: Arc::default(), requests: Arc::default() };
        let handle = server.clone();
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let handle = handle.clone();
                tokio::spawn(async move {
                    let _ = handle.serve(stream).await;
                });
            }
        });
        server
    }

    /// Answers `method path` (path matched as a prefix, query ignored) with `replies` in turn.
    pub fn route(&self, method: &str, path: &str, replies: Vec<Reply>) {
        let mut routes = self.routes.lock().unwrap_or_else(|e| e.into_inner());
        routes.retain(|r| !(r.method == method && r.path == path));
        routes.push(Route { method: method.into(), path: path.into(), replies });
    }

    pub fn requests(&self) -> Vec<Recorded> {
        self.requests.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    fn next_reply(&self, method: &str, path: &str) -> Reply {
        let mut routes = self.routes.lock().unwrap_or_else(|e| e.into_inner());
        let route = routes.iter_mut().find(|r| r.method == method && path.starts_with(&r.path));
        match route {
            Some(r) if r.replies.len() > 1 => r.replies.remove(0),
            Some(r) => r.replies[0].clone(),
            None => Reply::status(404, json!({ "error": { "message": format!("no route for {method} {path}") } })),
        }
    }

    async fn serve(&self, mut stream: TcpStream) -> std::io::Result<()> {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 8192];
        let header_end = loop {
            let n = stream.read(&mut chunk).await?;
            if n == 0 {
                return Ok(());
            }
            buf.extend_from_slice(&chunk[..n]);
            if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                break pos + 4;
            }
        };
        let head = String::from_utf8_lossy(&buf[..header_end]).to_string();
        let mut lines = head.lines();
        let mut first = lines.next().unwrap_or_default().split_whitespace();
        let method = first.next().unwrap_or_default().to_string();
        let path = first.next().unwrap_or_default().to_string();
        let headers: Vec<(String, String)> = lines
            .filter_map(|l| l.split_once(':').map(|(k, v)| (k.trim().to_string(), v.trim().to_string())))
            .collect();
        let length = headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("content-length"))
            .and_then(|(_, v)| v.parse::<usize>().ok())
            .unwrap_or(0);
        while buf.len() < header_end + length {
            let n = stream.read(&mut chunk).await?;
            if n == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
        }
        let body = String::from_utf8_lossy(&buf[header_end..]).to_string();
        let route_path = path.split('?').next().unwrap_or_default().to_string();
        self.requests.lock().unwrap_or_else(|e| e.into_inner()).push(Recorded {
            method: method.clone(),
            path: path.clone(),
            headers,
            body,
        });

        let reply = self.next_reply(&method, &route_path);
        let head =
            format!("HTTP/1.1 {} X\r\nContent-Type: {}\r\nConnection: close\r\n\r\n", reply.status, reply.content_type);
        stream.write_all(head.as_bytes()).await?;
        for c in &reply.chunks {
            if !reply.delay.is_zero() {
                tokio::time::sleep(reply.delay).await;
            }
            stream.write_all(c.as_bytes()).await?;
            stream.flush().await?;
        }
        stream.shutdown().await
    }
}
