function groupAnagrams(strs) {
  const groups = new Map();
  for (const s of strs) {
    const counts = new Array(26).fill(0);
    for (let i = 0; i < s.length; i++) counts[s.charCodeAt(i) - 97]++;
    const key = counts.join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()];
}
