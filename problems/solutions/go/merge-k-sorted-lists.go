type mergeKHeap []*ListNode

func (h mergeKHeap) Len() int           { return len(h) }
func (h mergeKHeap) Less(i, j int) bool { return h[i].Val < h[j].Val }
func (h mergeKHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *mergeKHeap) Push(x any)        { *h = append(*h, x.(*ListNode)) }
func (h *mergeKHeap) Pop() any {
	old := *h
	node := old[len(old)-1]
	*h = old[:len(old)-1]
	return node
}

func mergeKLists(lists []*ListNode) *ListNode {
	h := &mergeKHeap{}
	for _, node := range lists {
		if node != nil {
			*h = append(*h, node)
		}
	}
	heap.Init(h)
	dummy := &ListNode{}
	tail := dummy
	for h.Len() > 0 {
		node := heap.Pop(h).(*ListNode)
		tail.Next = node
		tail = node
		if node.Next != nil {
			heap.Push(h, node.Next)
		}
	}
	return dummy.Next
}
