function findMedianSortedArrays(nums1, nums2) {
  if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1);
  const m = nums1.length, n = nums2.length;
  const half = (m + n + 1) >> 1;
  let lo = 0, hi = m;
  while (lo <= hi) {
    const i = (lo + hi) >> 1; // elements taken from nums1 into the left half
    const j = half - i;       // elements taken from nums2 into the left half
    const left1 = i > 0 ? nums1[i - 1] : -Infinity;
    const right1 = i < m ? nums1[i] : Infinity;
    const left2 = j > 0 ? nums2[j - 1] : -Infinity;
    const right2 = j < n ? nums2[j] : Infinity;
    if (left1 > right2) hi = i - 1;
    else if (left2 > right1) lo = i + 1;
    else {
      const leftMax = Math.max(left1, left2);
      if ((m + n) % 2 === 1) return leftMax;
      return (leftMax + Math.min(right1, right2)) / 2;
    }
  }
  return 0;
}
