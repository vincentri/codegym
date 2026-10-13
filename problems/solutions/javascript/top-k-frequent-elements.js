function topKFrequent(nums, k) {
  const counts = new Map();
  for (const x of nums) counts.set(x, (counts.get(x) || 0) + 1);
  // buckets[f] holds every value that occurs exactly f times
  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [value, freq] of counts) buckets[freq].push(value);
  const result = [];
  for (let f = nums.length; f > 0 && result.length < k; f--) {
    for (const value of buckets[f]) {
      result.push(value);
      if (result.length === k) break;
    }
  }
  return result;
}
