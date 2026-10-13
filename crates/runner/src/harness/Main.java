// CodeGym test harness for Java. `cgCall`, generated from the problem's signature, is appended
// inside the class below.

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

class ListNode {
    public int val;
    public ListNode next;
    public ListNode() {}
    public ListNode(int val) { this.val = val; }
    public ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    public int val;
    public TreeNode left, right;
    public TreeNode() {}
    public TreeNode(int val) { this.val = val; }
    public TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

public class Main {
    static final int OUT_LIMIT = 65536;

    // --- JSON reading ---------------------------------------------------------------

    static String src;
    static int pos;

    static Object parse(String s) {
        src = s;
        pos = 0;
        Object v = value();
        return v;
    }

    static void ws() {
        while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) pos++;
    }

    static Object value() {
        ws();
        char c = src.charAt(pos);
        if (c == '{') {
            pos++;
            Map<String, Object> m = new LinkedHashMap<>();
            ws();
            if (src.charAt(pos) == '}') { pos++; return m; }
            while (true) {
                ws();
                String k = (String) value();
                ws();
                pos++; // :
                m.put(k, value());
                ws();
                if (src.charAt(pos++) == '}') return m;
            }
        }
        if (c == '[') {
            pos++;
            List<Object> a = new ArrayList<>();
            ws();
            if (src.charAt(pos) == ']') { pos++; return a; }
            while (true) {
                a.add(value());
                ws();
                if (src.charAt(pos++) == ']') return a;
            }
        }
        if (c == '"') {
            StringBuilder b = new StringBuilder();
            pos++;
            while (src.charAt(pos) != '"') {
                char ch = src.charAt(pos++);
                if (ch == '\\') {
                    char e = src.charAt(pos++);
                    switch (e) {
                        case 'n': b.append('\n'); break;
                        case 't': b.append('\t'); break;
                        case 'r': b.append('\r'); break;
                        case 'b': b.append('\b'); break;
                        case 'f': b.append('\f'); break;
                        case 'u': b.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16)); pos += 4; break;
                        default: b.append(e);
                    }
                } else b.append(ch);
            }
            pos++;
            return b.toString();
        }
        if (src.startsWith("true", pos)) { pos += 4; return Boolean.TRUE; }
        if (src.startsWith("false", pos)) { pos += 5; return Boolean.FALSE; }
        if (src.startsWith("null", pos)) { pos += 4; return null; }
        int start = pos;
        while (pos < src.length() && "+-0123456789.eE".indexOf(src.charAt(pos)) >= 0) pos++;
        String n = src.substring(start, pos);
        if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
        return Long.parseLong(n);
    }

    // --- JSON writing ---------------------------------------------------------------

    static void str(StringBuilder b, String s) {
        b.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        b.append('"');
    }

    static void json(StringBuilder b, Object o) {
        if (o == null) { b.append("null"); return; }
        if (o instanceof Boolean) { b.append(o.toString()); return; }
        if (o instanceof Double || o instanceof Float) {
            double d = ((Number) o).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) throw new IllegalArgumentException("the answer isn't a finite number");
            b.append(Double.toString(d));
            return;
        }
        if (o instanceof Number) { b.append(((Number) o).longValue()); return; }
        if (o instanceof Character) { str(b, o.toString()); return; }
        if (o instanceof String) { str(b, (String) o); return; }
        if (o instanceof ListNode) { listNode(b, (ListNode) o); return; }
        if (o instanceof TreeNode) { treeNode(b, (TreeNode) o); return; }
        if (o instanceof ListNode[]) {
            b.append('[');
            ListNode[] a = (ListNode[]) o;
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); listNode(b, a[i]); }
            b.append(']');
            return;
        }
        if (o.getClass().isArray()) {
            b.append('[');
            int n = java.lang.reflect.Array.getLength(o);
            for (int i = 0; i < n; i++) {
                if (i > 0) b.append(',');
                json(b, java.lang.reflect.Array.get(o, i));
            }
            b.append(']');
            return;
        }
        if (o instanceof Collection) {
            b.append('[');
            boolean first = true;
            for (Object x : (Collection<?>) o) {
                if (!first) b.append(',');
                first = false;
                json(b, x);
            }
            b.append(']');
            return;
        }
        throw new IllegalArgumentException("can't turn a " + o.getClass().getSimpleName() + " into an answer");
    }

    static void listNode(StringBuilder b, ListNode n) {
        b.append('[');
        int count = 0;
        for (ListNode p = n; p != null; p = p.next) {
            if (++count > 100000) throw new IllegalArgumentException("the returned list has a cycle or is too long");
            if (count > 1) b.append(',');
            b.append(p.val);
        }
        b.append(']');
    }

    static void treeNode(StringBuilder b, TreeNode root) {
        List<String> out = new ArrayList<>();
        List<TreeNode> order = new ArrayList<>();
        order.add(root);
        for (int i = 0; i < order.size(); i++) {
            TreeNode n = order.get(i);
            if (n == null) { out.add("null"); continue; }
            if (order.size() > 400000) throw new IllegalArgumentException("the returned tree has a cycle or is too large");
            out.add(Integer.toString(n.val));
            order.add(n.left);
            order.add(n.right);
        }
        while (!out.isEmpty() && out.get(out.size() - 1).equals("null")) out.remove(out.size() - 1);
        b.append('[').append(String.join(",", out)).append(']');
    }

    // --- argument conversion ----------------------------------------------------------

    static int cgInt(Object o) { return ((Number) o).intValue(); }
    static double cgDouble(Object o) { return ((Number) o).doubleValue(); }
    static boolean cgBool(Object o) { return (Boolean) o; }
    static String cgString(Object o) { return (String) o; }
    static List<?> cgList(Object o) { return (List<?>) o; }

    static int[] cgIntArr(Object o) {
        List<?> l = cgList(o);
        int[] a = new int[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = cgInt(l.get(i));
        return a;
    }
    static double[] cgDoubleArr(Object o) {
        List<?> l = cgList(o);
        double[] a = new double[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = cgDouble(l.get(i));
        return a;
    }
    static boolean[] cgBoolArr(Object o) {
        List<?> l = cgList(o);
        boolean[] a = new boolean[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = cgBool(l.get(i));
        return a;
    }
    static String[] cgStringArr(Object o) {
        List<?> l = cgList(o);
        String[] a = new String[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = cgString(l.get(i));
        return a;
    }
    static int[][] cgIntMatrix(Object o) {
        List<?> l = cgList(o);
        int[][] a = new int[l.size()][];
        for (int i = 0; i < a.length; i++) a[i] = cgIntArr(l.get(i));
        return a;
    }
    static String[][] cgStringMatrix(Object o) {
        List<?> l = cgList(o);
        String[][] a = new String[l.size()][];
        for (int i = 0; i < a.length; i++) a[i] = cgStringArr(l.get(i));
        return a;
    }
    static char[][] cgCharMatrix(Object o) {
        List<?> l = cgList(o);
        char[][] a = new char[l.size()][];
        for (int i = 0; i < a.length; i++) {
            List<?> row = cgList(l.get(i));
            a[i] = new char[row.size()];
            for (int j = 0; j < a[i].length; j++) a[i][j] = cgString(row.get(j)).charAt(0);
        }
        return a;
    }
    static ListNode cgListNode(Object o) {
        int[] v = cgIntArr(o);
        ListNode head = null;
        for (int i = v.length - 1; i >= 0; i--) head = new ListNode(v[i], head);
        return head;
    }
    static ListNode[] cgListNodes(Object o) {
        List<?> l = cgList(o);
        ListNode[] a = new ListNode[l.size()];
        for (int i = 0; i < a.length; i++) a[i] = cgListNode(l.get(i));
        return a;
    }
    static TreeNode cgTreeNode(Object o) {
        List<?> v = cgList(o);
        if (v.isEmpty() || v.get(0) == null) return null;
        TreeNode root = new TreeNode(cgInt(v.get(0)));
        List<TreeNode> queue = new ArrayList<>();
        queue.add(root);
        int i = 1;
        for (int head = 0; i < v.size() && head < queue.size(); head++) {
            TreeNode node = queue.get(head);
            if (i < v.size() && v.get(i) != null) { node.left = new TreeNode(cgInt(v.get(i))); queue.add(node.left); }
            i++;
            if (i < v.size() && v.get(i) != null) { node.right = new TreeNode(cgInt(v.get(i))); queue.add(node.right); }
            i++;
        }
        return root;
    }

    // --- running ------------------------------------------------------------------------

    /** Frames from the solver's file only. */
    static String errorText(Throwable e) {
        StringBuilder b = new StringBuilder(e.toString());
        for (StackTraceElement f : e.getStackTrace()) {
            if ("Solution.java".equals(f.getFileName())) {
                b.append("\n    at ").append(f.getClassName()).append('.').append(f.getMethodName())
                    .append("(Solution.java:").append(f.getLineNumber()).append(')');
            }
        }
        return b.toString();
    }

    public static void main(String[] argv) throws Exception {
        String input = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
        @SuppressWarnings("unchecked")
        Map<String, Object> spec = (Map<String, Object>) parse(input);
        String mark = "@@CODEGYM:" + spec.get("nonce") + "@@";
        PrintStream real = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        real.println(mark + "{\"ready\":true}");
        List<?> tests = cgList(spec.get("tests"));
        for (int i = 0; i < tests.size(); i++) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            PrintStream capture = new PrintStream(buf, true, "UTF-8");
            System.setOut(capture);
            System.setErr(capture);
            StringBuilder rec = new StringBuilder("{\"i\":").append(i);
            long[] ns = new long[1];
            try {
                Object value = cgCall(cgList(tests.get(i)), ns);
                StringBuilder v = new StringBuilder();
                json(v, value);
                rec.append(",\"ok\":true,\"value\":").append(v);
            } catch (Throwable e) {
                rec.append(",\"ok\":false,\"error\":");
                str(rec, errorText(e));
            } finally {
                System.setOut(real);
                System.setErr(real);
            }
            String out = buf.toString("UTF-8");
            if (out.length() > OUT_LIMIT) out = out.substring(0, OUT_LIMIT) + "… (output truncated)\n";
            rec.append(",\"ms\":").append(ns[0] / 1e6).append(",\"out\":");
            str(rec, out);
            rec.append('}');
            real.println(mark + rec);
        }
        real.println(mark + "{\"done\":true}");
        real.flush();
    }

    // __CGCALL__
}
