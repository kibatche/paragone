import {
  type BaseTestCase,
  createBaseTest,
  loadExpectedResults,
} from "../base";

const testCases: BaseTestCase[] = [
  {
    jsFileName: "1.js",
    expectedResults: loadExpectedResults("postmessage", 1),
  },
];

testCases.forEach((testCase, i) => {
  createBaseTest("postmessage", testCase, "postmessage", i + 1);
});
