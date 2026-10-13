function groupAnagrams(strs: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const s of strs) {
    const counts: number[] = new Array(26).fill(0);
    for (let i = 0; i < s.length; i++) counts[s.charCodeAt(i) - 97]++;
    const key = counts.join(',');
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(s);
  }
  return [...groups.values()];
}
