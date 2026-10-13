package main

// CodeGym test harness. `cgCall`, generated from the problem's signature, is appended below.

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime/debug"
	"strings"
	"time"
)

type ListNode struct {
	Val  int
	Next *ListNode
}

type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

type cgInputError string

const cgOutLimit = 65536

var cgStdout = os.Stdout

func cgDecode(raw json.RawMessage, into any, name string) {
	if err := json.Unmarshal(raw, into); err != nil {
		panic(cgInputError(fmt.Sprintf("invalid value for %s: %v", name, err)))
	}
}

func cgSince(start time.Time) float64 {
	return float64(time.Since(start).Nanoseconds()) / 1e6
}

func cgToList(a []int) *ListNode {
	var head *ListNode
	for i := len(a) - 1; i >= 0; i-- {
		head = &ListNode{Val: a[i], Next: head}
	}
	return head
}

func cgToLists(a [][]int) []*ListNode {
	out := make([]*ListNode, len(a))
	for i, v := range a {
		out[i] = cgToList(v)
	}
	return out
}

func cgFromList(head *ListNode) []int {
	out := []int{}
	for n := head; n != nil; n = n.Next {
		if len(out) >= 100000 {
			panic("the returned list has a cycle or is too long")
		}
		out = append(out, n.Val)
	}
	return out
}

func cgFromLists(a []*ListNode) [][]int {
	out := make([][]int, len(a))
	for i, v := range a {
		out[i] = cgFromList(v)
	}
	return out
}

func cgToTree(a []*int) *TreeNode {
	if len(a) == 0 || a[0] == nil {
		return nil
	}
	root := &TreeNode{Val: *a[0]}
	queue := []*TreeNode{root}
	for i, head := 1, 0; i < len(a) && head < len(queue); head++ {
		node := queue[head]
		if i < len(a) && a[i] != nil {
			node.Left = &TreeNode{Val: *a[i]}
			queue = append(queue, node.Left)
		}
		i++
		if i < len(a) && a[i] != nil {
			node.Right = &TreeNode{Val: *a[i]}
			queue = append(queue, node.Right)
		}
		i++
	}
	return root
}

func cgFromTree(root *TreeNode) []*int {
	out := []*int{}
	queue := []*TreeNode{root}
	for head := 0; head < len(queue); head++ {
		n := queue[head]
		if n == nil {
			out = append(out, nil)
			continue
		}
		if len(queue) > 400000 {
			panic("the returned tree has a cycle or is too large")
		}
		v := n.Val
		out = append(out, &v)
		queue = append(queue, n.Left, n.Right)
	}
	for len(out) > 0 && out[len(out)-1] == nil {
		out = out[:len(out)-1]
	}
	return out
}

func cgToBytes(a [][]string) [][]byte {
	out := make([][]byte, len(a))
	for i, row := range a {
		out[i] = make([]byte, len(row))
		for j, s := range row {
			if len(s) > 0 {
				out[i][j] = s[0]
			}
		}
	}
	return out
}

func cgFromBytes(a [][]byte) [][]string {
	out := make([][]string, len(a))
	for i, row := range a {
		out[i] = make([]string, len(row))
		for j, b := range row {
			out[i][j] = string(rune(b))
		}
	}
	return out
}

func cgSlice[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func cgMatrix[T any](m [][]T) [][]T {
	if m == nil {
		return [][]T{}
	}
	for i := range m {
		if m[i] == nil {
			m[i] = []T{}
		}
	}
	return m
}

// cgStack keeps only the frames in the solver's file.
func cgStack() string {
	lines := strings.Split(string(debug.Stack()), "\n")
	var out []string
	for i := 1; i+1 < len(lines); i += 2 {
		if strings.Contains(lines[i+1], "solution.go:") {
			loc := strings.Fields(strings.TrimSpace(lines[i+1]))
			if len(loc) > 0 {
				out = append(out, lines[i], "\t"+loc[0])
			}
		}
	}
	return strings.Join(out, "\n")
}

func cgRun(i int, args []json.RawMessage) (rec map[string]any) {
	rec = map[string]any{"i": i, "ok": false, "ms": 0.0}
	r, w, err := os.Pipe()
	done := make(chan string, 1)
	if err == nil {
		os.Stdout = w
		go func() {
			b, _ := io.ReadAll(io.LimitReader(r, cgOutLimit))
			_, _ = io.Copy(io.Discard, r)
			done <- string(b)
		}()
	} else {
		done <- ""
	}
	defer func() {
		if p := recover(); p != nil {
			if e, ok := p.(cgInputError); ok {
				rec["error"] = string(e)
			} else {
				rec["error"] = strings.TrimSpace(fmt.Sprintf("panic: %v\n\n%s", p, cgStack()))
			}
		}
		if w != nil {
			w.Close()
		}
		os.Stdout = cgStdout
		rec["out"] = <-done
		if r != nil {
			r.Close()
		}
	}()
	value, ms := cgCall(args)
	rec["ok"] = true
	rec["value"] = value
	rec["ms"] = ms
	return
}

func main() {
	debug.SetMaxStack(512 << 20)
	data, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	var spec struct {
		Nonce string              `json:"nonce"`
		Tests [][]json.RawMessage `json:"tests"`
	}
	if err := json.Unmarshal(data, &spec); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	mark := []byte("@@CODEGYM:" + spec.Nonce + "@@")
	send := func(v map[string]any) {
		b, err := json.Marshal(v)
		if err != nil {
			b, _ = json.Marshal(map[string]any{
				"i": v["i"], "ok": false, "out": v["out"], "ms": v["ms"],
				"error": "Your answer can't be converted to JSON: " + err.Error(),
			})
		}
		line := append(append(append([]byte{}, mark...), b...), '\n')
		_, _ = cgStdout.Write(line)
	}
	send(map[string]any{"ready": true})
	for i, args := range spec.Tests {
		send(cgRun(i, args))
	}
	send(map[string]any{"done": true})
}
