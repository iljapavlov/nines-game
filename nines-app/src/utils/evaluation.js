import { evaluate } from 'mathjs';

export const checkExpression = (expression, target) => {
  const nineCount = (expression.match(/9/g) || []).length;
  if (nineCount !== 3) {
    return { valid: false, message: 'Must use exactly three 9s' };
  }
  try {
    const result = evaluate(expression);
    if (result === target) {
      return { valid: true, message: 'Correct!' };
    } else {
      return { valid: false, message: `Result: ${result}, Target: ${target}` };
    }
  } catch (e) {
    return { valid: false, message: 'Invalid expression' };
  }
};