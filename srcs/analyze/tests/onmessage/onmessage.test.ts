import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("onmessage", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("onmessage", testCase, "onmessage", i + 1);
});
