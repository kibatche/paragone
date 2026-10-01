import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("document-domain", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("document-domain", testCase, "document-domain", i + 1);
});
