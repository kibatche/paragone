import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("path-attribute-assignment", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest(
    "path-attribute-assignment",
    testCase,
    "path-attribute-assignment",
    i + 1,
  );
});
