import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("create-contextual-fragment", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest(
    "create-contextual-fragment",
    testCase,
    "create-contextual-fragment",
    i + 1,
  );
});
