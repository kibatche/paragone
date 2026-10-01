import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("location", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("location", testCase, "location", i + 1);
});
