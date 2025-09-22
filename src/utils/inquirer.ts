import inquirer from "inquirer";

// inquirer 8.x 版本支持通过 prefix 属性来移除问号
export async function prompt(
  questions: any,
  initialAnswers?: any,
): Promise<any> {
  // 处理问题数组，为每个问题设置空的 prefix
  const processedQuestions = Array.isArray(questions)
    ? questions.map((q) => ({ ...q, prefix: "" }))
    : { ...questions, prefix: "" };

  return inquirer.prompt(processedQuestions, initialAnswers);
}

// 导出原始的 inquirer 对象，以防需要使用其他功能
export { inquirer };
export default { prompt };
