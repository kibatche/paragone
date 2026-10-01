import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("unsafe-html-wrapper", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("unsafe-html-wrapper", testCase, "unsafe-html-wrapper", i + 1);
});
