const cases = [
  { prompt: "Use @image 1 as the hero", index: 1, type: "image", expected: true },
  { prompt: "Use @img1 as the hero", index: 1, type: "image", expected: true },
  { prompt: "Use @IMAGE 1 as the hero", index: 1, type: "image", expected: true },
  { prompt: "Use @image 2 as the hero", index: 1, type: "image", expected: false },
  { prompt: "Use @video 1 for motion", index: 1, type: "video", expected: true },
];

for (const test of cases) {
  const alt = test.type === "image" ? new RegExp(`@(Image|img)\\s*${test.index}\\b`, "i") : new RegExp(`@(Video|vid)\\s*${test.index}\\b`, "i");
  const matched = alt.test(test.prompt);
  if (matched !== test.expected) throw new Error(`Mention check failed: ${test.prompt}`);
}

console.log(`Mention regex checks passed: ${cases.length}`);
