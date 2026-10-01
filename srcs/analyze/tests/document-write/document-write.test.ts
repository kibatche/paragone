import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("document-write", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("document-write", testCase, "document-write", i + 1);
});
