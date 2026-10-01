import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("srcdoc", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("srcdoc", testCase, "srcdoc", i + 1);
});
