import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("create-object-url", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("create-object-url", testCase, "create-object-url", i + 1);
});
