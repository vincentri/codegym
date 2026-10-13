//! A minimal Server-Sent Events parser. Bytes arrive in arbitrary chunks (a line, or even a
//! UTF-8 character, may be split across two), so lines are buffered until complete.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseEvent {
    pub event: Option<String>,
    pub data: String,
}

#[derive(Debug, Default)]
pub struct SseParser {
    pending: Vec<u8>,
    event: Option<String>,
    data: Vec<String>,
}

impl SseParser {
    /// Feeds a chunk and returns every event it completed.
    pub fn feed(&mut self, chunk: &[u8]) -> Vec<SseEvent> {
        self.pending.extend_from_slice(chunk);
        let mut out = Vec::new();
        while let Some(pos) = self.pending.iter().position(|&b| b == b'\n') {
            let raw: Vec<u8> = self.pending.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&raw);
            let line = line.trim_end_matches(['\n', '\r']);
            if line.is_empty() {
                if !self.data.is_empty() || self.event.is_some() {
                    out.push(SseEvent { event: self.event.take(), data: std::mem::take(&mut self.data).join("\n") });
                }
            } else if let Some(rest) = line.strip_prefix("data:") {
                self.data.push(rest.strip_prefix(' ').unwrap_or(rest).to_string());
            } else if let Some(rest) = line.strip_prefix("event:") {
                self.event = Some(rest.trim().to_string());
            }
            // Comments (":") and other fields (id, retry) are ignored.
        }
        out
    }

    /// Returns a final event when the stream ended without a blank line.
    pub fn finish(&mut self) -> Option<SseEvent> {
        if !self.pending.is_empty() {
            let mut rest = std::mem::take(&mut self.pending);
            rest.extend_from_slice(b"\n\n");
            return self.feed(&rest).pop();
        }
        if self.data.is_empty() {
            return None;
        }
        Some(SseEvent { event: self.event.take(), data: std::mem::take(&mut self.data).join("\n") })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_any_chunking() {
        let stream = "event: message_start\ndata: {\"a\":1}\n\n: keep-alive\n\ndata: héllo\r\ndata: world\r\n\r\ndata: [DONE]\n\n";
        let whole = SseParser::default().feed(stream.as_bytes());
        assert_eq!(whole.len(), 3);
        assert_eq!(whole[0], SseEvent { event: Some("message_start".into()), data: "{\"a\":1}".into() });
        assert_eq!(whole[1].data, "héllo\nworld");
        // Byte by byte, splitting the two-byte "é" too, gives the same events.
        let mut parser = SseParser::default();
        let split: Vec<SseEvent> = stream.as_bytes().iter().flat_map(|b| parser.feed(&[*b])).collect();
        assert_eq!(split, whole);
    }

    #[test]
    fn flushes_an_unterminated_event() {
        let mut parser = SseParser::default();
        assert!(parser.feed(b"data: tail").is_empty());
        assert_eq!(parser.finish().unwrap().data, "tail");
    }
}
