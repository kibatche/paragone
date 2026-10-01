import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("html-property-call", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("html-property-call", testCase, "html-property-call", i + 1);
});
