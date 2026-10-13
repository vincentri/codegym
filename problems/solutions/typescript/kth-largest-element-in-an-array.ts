function findKthLargest(nums: number[], k: number): number {
  // Min-heap holding the k largest values seen so far; heap[0] is the answer.
  const heap: number[] = [];
  const siftUp = (i: number): void => {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent] <= heap[i]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const siftDown = (i: number): void => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < heap.length && heap[l] < heap[smallest]) smallest = l;
      if (r < heap.length && heap[r] < heap[smallest]) smallest = r;
      if (smallest === i) return;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  };
  for (const x of nums) {
    if (heap.length < k) {
      heap.push(x);
      siftUp(heap.length - 1);
    } else if (x > heap[0]) {
      heap[0] = x;
      siftDown(0);
    }
  }
  return heap[0];
}
