type kthHeap []int

func (h kthHeap) Len() int           { return len(h) }
func (h kthHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h kthHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *kthHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *kthHeap) Pop() any {
	old := *h
	x := old[len(old)-1]
	*h = old[:len(old)-1]
	return x
}

func findKthLargest(nums []int, k int) int {
	// Min-heap holding the k largest values seen so far; its root is the answer.
	h := kthHeap(slices.Clone(nums[:k]))
	heap.Init(&h)
	for _, x := range nums[k:] {
		if x > h[0] {
			h[0] = x
			heap.Fix(&h, 0)
		}
	}
	return h[0]
}
