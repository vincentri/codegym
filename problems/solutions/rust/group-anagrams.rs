impl Solution {
    pub fn group_anagrams(strs: Vec<String>) -> Vec<Vec<String>> {
        let mut groups: HashMap<Vec<char>, Vec<String>> = HashMap::new();
        for s in strs {
            let mut key: Vec<char> = s.chars().collect();
            key.sort_unstable();
            groups.entry(key).or_default().push(s);
        }
        groups.into_values().collect()
    }
}
