// CodeGym test harness for C++. `cg_call`, generated from the problem's signature, is
// appended at the end.
#include "prelude.hpp"
#include "solution.cpp"

namespace cg {

// --- JSON reading --------------------------------------------------------------------

struct Json {
    enum Kind { Null, Bool, Num, Str, Arr, Obj } kind = Null;
    bool b = false;
    double num = 0;
    bool integral = false;
    long long i = 0;
    std::string s;
    std::vector<Json> arr;
    std::vector<std::pair<std::string, Json>> obj;

    const Json &at(const std::string &key) const {
        for (auto &kv : obj)
            if (kv.first == key) return kv.second;
        throw std::runtime_error("missing key " + key);
    }
};

struct Reader {
    const std::string &src;
    size_t pos = 0;
    void ws() { while (pos < src.size() && isspace((unsigned char)src[pos])) pos++; }
    Json value() {
        ws();
        Json j;
        char c = src[pos];
        if (c == '{') {
            j.kind = Json::Obj;
            pos++;
            ws();
            if (src[pos] == '}') { pos++; return j; }
            while (true) {
                ws();
                std::string k = value().s;
                ws();
                pos++;
                j.obj.emplace_back(k, value());
                ws();
                if (src[pos++] == '}') return j;
            }
        }
        if (c == '[') {
            j.kind = Json::Arr;
            pos++;
            ws();
            if (src[pos] == ']') { pos++; return j; }
            while (true) {
                j.arr.push_back(value());
                ws();
                if (src[pos++] == ']') return j;
            }
        }
        if (c == '"') {
            j.kind = Json::Str;
            pos++;
            while (src[pos] != '"') {
                char ch = src[pos++];
                if (ch == '\\') {
                    char e = src[pos++];
                    if (e == 'n') j.s += '\n';
                    else if (e == 't') j.s += '\t';
                    else if (e == 'r') j.s += '\r';
                    else if (e == 'u') {
                        unsigned cp = std::stoul(src.substr(pos, 4), nullptr, 16);
                        pos += 4;
                        if (cp < 0x80) j.s += (char)cp;
                        else if (cp < 0x800) { j.s += (char)(0xC0 | (cp >> 6)); j.s += (char)(0x80 | (cp & 0x3F)); }
                        else { j.s += (char)(0xE0 | (cp >> 12)); j.s += (char)(0x80 | ((cp >> 6) & 0x3F)); j.s += (char)(0x80 | (cp & 0x3F)); }
                    } else j.s += e;
                } else j.s += ch;
            }
            pos++;
            return j;
        }
        if (src.compare(pos, 4, "true") == 0) { pos += 4; j.kind = Json::Bool; j.b = true; return j; }
        if (src.compare(pos, 5, "false") == 0) { pos += 5; j.kind = Json::Bool; return j; }
        if (src.compare(pos, 4, "null") == 0) { pos += 4; return j; }
        size_t start = pos;
        while (pos < src.size() && strchr("+-0123456789.eE", src[pos])) pos++;
        std::string n = src.substr(start, pos - start);
        j.kind = Json::Num;
        j.num = std::stod(n);
        j.integral = n.find_first_of(".eE") == std::string::npos;
        if (j.integral) j.i = std::stoll(n);
        return j;
    }
};

// --- argument conversion -------------------------------------------------------------

inline void from(const Json &j, int &v) { v = (int)j.i; }
inline void from(const Json &j, long long &v) { v = j.i; }
inline void from(const Json &j, double &v) { v = j.num; }
inline void from(const Json &j, bool &v) { v = j.b; }
inline void from(const Json &j, std::string &v) { v = j.s; }
inline void from(const Json &j, char &v) { v = j.s.empty() ? '\0' : j.s[0]; }
template <class T> void from(const Json &j, std::vector<T> &v) {
    v.clear();
    for (auto &x : j.arr) { T t; from(x, t); v.push_back(t); }
}
inline void from(const Json &j, std::vector<bool> &v) {
    v.clear();
    for (auto &x : j.arr) v.push_back(x.b);
}
inline void from(const Json &j, ListNode *&v) {
    ListNode *head = nullptr;
    for (size_t k = j.arr.size(); k-- > 0;) head = new ListNode((int)j.arr[k].i, head);
    v = head;
}
inline void from(const Json &j, TreeNode *&v) {
    v = nullptr;
    if (j.arr.empty() || j.arr[0].kind == Json::Null) return;
    v = new TreeNode((int)j.arr[0].i);
    std::vector<TreeNode *> queue{v};
    size_t i = 1;
    for (size_t head = 0; i < j.arr.size() && head < queue.size(); head++) {
        TreeNode *node = queue[head];
        if (i < j.arr.size() && j.arr[i].kind != Json::Null) { node->left = new TreeNode((int)j.arr[i].i); queue.push_back(node->left); }
        i++;
        if (i < j.arr.size() && j.arr[i].kind != Json::Null) { node->right = new TreeNode((int)j.arr[i].i); queue.push_back(node->right); }
        i++;
    }
}

// --- JSON writing --------------------------------------------------------------------

inline void str(std::string &o, const std::string &s) {
    o += '"';
    for (char c : s) {
        if (c == '"') o += "\\\"";
        else if (c == '\\') o += "\\\\";
        else if (c == '\n') o += "\\n";
        else if (c == '\r') o += "\\r";
        else if (c == '\t') o += "\\t";
        else if ((unsigned char)c < 0x20) { char buf[8]; snprintf(buf, sizeof buf, "\\u%04x", c); o += buf; }
        else o += c;
    }
    o += '"';
}

inline void to(std::string &o, int v) { o += std::to_string(v); }
inline void to(std::string &o, long v) { o += std::to_string(v); }
inline void to(std::string &o, long long v) { o += std::to_string(v); }
inline void to(std::string &o, unsigned v) { o += std::to_string(v); }
inline void to(std::string &o, unsigned long v) { o += std::to_string(v); }
inline void to(std::string &o, unsigned long long v) { o += std::to_string(v); }
inline void to(std::string &o, bool v) { o += v ? "true" : "false"; }
inline void to(std::string &o, double v) {
    if (!std::isfinite(v)) throw std::runtime_error("the answer isn't a finite number");
    char buf[64];
    snprintf(buf, sizeof buf, "%.17g", v);
    o += buf;
}
inline void to(std::string &o, float v) { to(o, (double)v); }
inline void to(std::string &o, char v) { str(o, std::string(1, v)); }
inline void to(std::string &o, const std::string &v) { str(o, v); }
inline void to(std::string &o, const char *v) { str(o, v); }
inline void to(std::string &o, ListNode *v) {
    o += '[';
    int n = 0;
    for (ListNode *p = v; p; p = p->next) {
        if (++n > 100000) throw std::runtime_error("the returned list has a cycle or is too long");
        if (n > 1) o += ',';
        o += std::to_string(p->val);
    }
    o += ']';
}
inline void to(std::string &o, TreeNode *v) {
    std::vector<TreeNode *> order{v};
    std::vector<std::string> out;
    for (size_t k = 0; k < order.size(); k++) {
        if (!order[k]) { out.push_back("null"); continue; }
        if (order.size() > 400000) throw std::runtime_error("the returned tree has a cycle or is too large");
        out.push_back(std::to_string(order[k]->val));
        order.push_back(order[k]->left);
        order.push_back(order[k]->right);
    }
    while (!out.empty() && out.back() == "null") out.pop_back();
    o += '[';
    for (size_t k = 0; k < out.size(); k++) { if (k) o += ','; o += out[k]; }
    o += ']';
}
template <class T> void to(std::string &o, const std::vector<T> &v);
inline void to(std::string &o, const std::vector<bool> &v) {
    o += '[';
    for (size_t k = 0; k < v.size(); k++) { if (k) o += ','; to(o, (bool)v[k]); }
    o += ']';
}
template <class T> void to(std::string &o, const std::vector<T> &v) {
    o += '[';
    for (size_t k = 0; k < v.size(); k++) { if (k) o += ','; to(o, v[k]); }
    o += ']';
}

template <class T> std::string json(const T &v) {
    std::string o;
    to(o, v);
    return o;
}

inline double since(std::chrono::steady_clock::time_point t0) {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}

}  // namespace cg

std::string cg_call(const std::vector<cg::Json> &a, double &ms);

int main() {
    std::ios::sync_with_stdio(true);
    std::string input((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
    cg::Reader reader{input};
    cg::Json spec = reader.value();
    std::string mark = "@@CODEGYM:" + spec.at("nonce").s + "@@";
    std::streambuf *real = std::cout.rdbuf();
    auto send = [&](const std::string &line) {
        std::cout.rdbuf(real);
        std::cout.flush();
        fflush(stdout);
        std::string l = mark + line + "\n";
        fwrite(l.data(), 1, l.size(), stdout);
        fflush(stdout);
    };
    send("{\"ready\":true}");
    const auto &tests = spec.at("tests").arr;
    for (size_t i = 0; i < tests.size(); i++) {
        std::ostringstream captured;
        std::cout.rdbuf(captured.rdbuf());
        std::string rec = "{\"i\":" + std::to_string(i);
        double ms = 0;
        try {
            std::string value = cg_call(tests[i].arr, ms);
            rec += ",\"ok\":true,\"value\":" + value;
        } catch (const std::exception &e) {
            rec += ",\"ok\":false,\"error\":";
            cg::str(rec, std::string("exception: ") + e.what());
        } catch (...) {
            rec += ",\"ok\":false,\"error\":\"an exception of unknown type was thrown\"";
        }
        std::cout.rdbuf(real);
        std::string out = captured.str();
        if (out.size() > 65536) out = out.substr(0, 65536) + "... (output truncated)\n";
        rec += ",\"ms\":";
        cg::to(rec, ms);
        rec += ",\"out\":";
        cg::str(rec, out);
        rec += "}";
        send(rec);
    }
    send("{\"done\":true}");
    return 0;
}

// __CGCALL__
