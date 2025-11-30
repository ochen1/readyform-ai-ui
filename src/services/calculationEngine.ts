/**
 * Calculation Engine for Real-Time Formula Evaluation
 * 
 * This module provides a safe formula parser and evaluator for calculated form fields.
 * Formulas use field IDs enclosed in curly braces as variable references.
 * 
 * Supported syntax:
 * - Field references: {Field Name} or {fieldId}
 * - Operators: +, -, *, /, (, )
 * - Numbers: integers and decimals
 * 
 * Example formulas:
 * - "{Gross weight} - {Vehicle weight}"
 * - "({Net weight} / 1000) * {Price per net tonne}"
 * - "{Total purchase price} - {Levy deductible}"
 */

import type { FormField } from '../store/types';

/**
 * Token types for formula lexer
 */
type TokenType = 'NUMBER' | 'FIELD_REF' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string | number;
}

/**
 * Extract field dependencies from a formula
 * Returns an array of field IDs that the formula depends on
 */
export function getFormulaDependencies(formula: string): string[] {
  const dependencies: string[] = [];
  const fieldRefRegex = /\{([^}]+)\}/g;
  let match;
  
  while ((match = fieldRefRegex.exec(formula)) !== null) {
    const fieldRef = match[1].trim();
    if (!dependencies.includes(fieldRef)) {
      dependencies.push(fieldRef);
    }
  }
  
  return dependencies;
}

/**
 * Resolve a field reference to its numeric value
 * Tries to match by ID first, then by name (case-insensitive)
 */
function resolveFieldValue(fieldRef: string, fields: FormField[]): number {
  // Try exact ID match first
  let field = fields.find(f => f.id === fieldRef);
  
  // Try case-insensitive name match
  if (!field) {
    const lowerRef = fieldRef.toLowerCase();
    field = fields.find(f => f.name.toLowerCase() === lowerRef || f.id.toLowerCase() === lowerRef);
  }
  
  if (!field) {
    console.warn(`Formula: Field "${fieldRef}" not found`);
    return 0;
  }
  
  const value = parseFloat(field.value);
  return isNaN(value) ? 0 : value;
}

/**
 * Tokenize a formula string
 */
function tokenize(formula: string, fields: FormField[]): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  
  while (pos < formula.length) {
    const char = formula[pos];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      pos++;
      continue;
    }
    
    // Field reference: {field name}
    if (char === '{') {
      const endPos = formula.indexOf('}', pos);
      if (endPos === -1) {
        throw new Error('Unterminated field reference');
      }
      const fieldRef = formula.slice(pos + 1, endPos).trim();
      const value = resolveFieldValue(fieldRef, fields);
      tokens.push({ type: 'NUMBER', value });
      pos = endPos + 1;
      continue;
    }
    
    // Number
    if (/[\d.]/.test(char)) {
      let numStr = '';
      while (pos < formula.length && /[\d.]/.test(formula[pos])) {
        numStr += formula[pos];
        pos++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }
    
    // Operators
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      pos++;
      continue;
    }
    
    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      pos++;
      continue;
    }
    
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      pos++;
      continue;
    }
    
    // Unknown character - skip
    console.warn(`Formula: Unexpected character "${char}" at position ${pos}`);
    pos++;
  }
  
  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

/**
 * Simple recursive descent parser for arithmetic expressions
 * Handles operator precedence correctly (* and / before + and -)
 */
class FormulaParser {
  private tokens: Token[];
  private pos: number = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  
  private current(): Token {
    return this.tokens[this.pos];
  }
  
  private consume(): Token {
    return this.tokens[this.pos++];
  }
  
  private expect(type: TokenType): Token {
    const token = this.consume();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return token;
  }
  
  /**
   * Parse expression: handles + and -
   */
  parse(): number {
    return this.parseAdditive();
  }
  
  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    
    while (this.current().type === 'OPERATOR' && 
           (this.current().value === '+' || this.current().value === '-')) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      
      if (op === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    
    return left;
  }
  
  private parseMultiplicative(): number {
    let left = this.parseUnary();
    
    while (this.current().type === 'OPERATOR' && 
           (this.current().value === '*' || this.current().value === '/')) {
      const op = this.consume().value;
      const right = this.parseUnary();
      
      if (op === '*') {
        left = left * right;
      } else {
        // Handle division by zero
        if (right === 0) {
          console.warn('Formula: Division by zero');
          return 0;
        }
        left = left / right;
      }
    }
    
    return left;
  }
  
  private parseUnary(): number {
    // Handle negative numbers
    if (this.current().type === 'OPERATOR' && this.current().value === '-') {
      this.consume();
      return -this.parsePrimary();
    }
    
    // Handle explicit positive
    if (this.current().type === 'OPERATOR' && this.current().value === '+') {
      this.consume();
    }
    
    return this.parsePrimary();
  }
  
  private parsePrimary(): number {
    const token = this.current();
    
    if (token.type === 'NUMBER') {
      this.consume();
      return token.value as number;
    }
    
    if (token.type === 'LPAREN') {
      this.consume(); // consume '('
      const result = this.parseAdditive();
      this.expect('RPAREN'); // consume ')'
      return result;
    }
    
    throw new Error(`Unexpected token: ${token.type}`);
  }
}

/**
 * Evaluate a formula string using field values
 * Returns the calculated numeric result as a string
 * 
 * @param formula - Formula string with {field} references
 * @param fields - Array of form fields with current values
 * @param decimalPlaces - Number of decimal places for formatting (default: 2)
 * @returns Calculated value as a string, or empty string on error
 */
export function evaluateFormula(
  formula: string, 
  fields: FormField[],
  decimalPlaces: number = 2
): string {
  if (!formula || !formula.trim()) {
    return '';
  }
  
  try {
    const tokens = tokenize(formula, fields);
    const parser = new FormulaParser(tokens);
    const result = parser.parse();
    
    // Handle edge cases
    if (isNaN(result) || !isFinite(result)) {
      return '';
    }
    
    // Format result
    // Use integer if result is a whole number, otherwise use decimal places
    if (Number.isInteger(result)) {
      return result.toString();
    }
    
    return result.toFixed(decimalPlaces);
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return '';
  }
}

/**
 * Check if a formula is valid (syntactically correct)
 */
export function isValidFormula(formula: string): boolean {
  if (!formula || !formula.trim()) {
    return false;
  }
  
  // Check for balanced braces
  const braceCount = (formula.match(/\{/g) || []).length;
  const closeBraceCount = (formula.match(/\}/g) || []).length;
  if (braceCount !== closeBraceCount) {
    return false;
  }
  
  // Check for at least one field reference
  if (!/\{[^}]+\}/.test(formula)) {
    return false;
  }
  
  // Try to tokenize with mock fields (we just check syntax)
  try {
    // Create mock fields for all references
    const mockFields: FormField[] = getFormulaDependencies(formula).map(id => ({
      id,
      originalName: id,
      name: id,
      type: 'number',
      description: '',
      required: false,
      readonly: false,
      ignore: false,
      value: '1',
    }));
    
    const tokens = tokenize(formula, mockFields);
    const parser = new FormulaParser(tokens);
    parser.parse();
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a dependency graph for calculated fields
 * Returns a map of field ID -> array of field IDs that depend on it
 */
export function buildDependencyGraph(fields: FormField[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  
  // Initialize all field IDs with empty arrays
  for (const field of fields) {
    graph.set(field.id, []);
  }
  
  // For each calculated field, add reverse dependencies
  for (const field of fields) {
    if (field.type === 'calculated' && field.formula) {
      const dependencies = getFormulaDependencies(field.formula);
      for (const depId of dependencies) {
        // Find the actual field ID (might be a name reference)
        const depField = fields.find(
          f => f.id === depId || f.name.toLowerCase() === depId.toLowerCase()
        );
        if (depField) {
          const dependents = graph.get(depField.id) || [];
          if (!dependents.includes(field.id)) {
            dependents.push(field.id);
            graph.set(depField.id, dependents);
          }
        }
      }
    }
  }
  
  return graph;
}

/**
 * Get all calculated fields that need to be recalculated when a field changes
 * Uses breadth-first traversal to handle cascading calculations
 */
export function getFieldsToRecalculate(
  changedFieldId: string,
  dependencyGraph: Map<string, string[]>
): string[] {
  const toRecalculate: string[] = [];
  const visited = new Set<string>();
  const queue = [changedFieldId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const dependents = dependencyGraph.get(currentId) || [];
    for (const dependentId of dependents) {
      if (!toRecalculate.includes(dependentId)) {
        toRecalculate.push(dependentId);
        queue.push(dependentId); // Check for cascading dependencies
      }
    }
  }
  
  return toRecalculate;
}

/**
 * Recalculate all calculated fields based on current field values
 * Returns a map of field ID -> new calculated value
 */
export function recalculateAllFields(fields: FormField[]): Map<string, string> {
  const results = new Map<string, string>();
  
  // Get all calculated fields
  const calculatedFields = fields.filter(f => f.type === 'calculated' && f.formula);
  
  // Sort by dependency order (fields that depend on others come later)
  // Simple approach: multiple passes until no changes
  const maxPasses = 10; // Prevent infinite loops
  let pass = 0;
  let changed = true;
  
  // Initialize with current values
  const workingFields = [...fields];
  
  while (changed && pass < maxPasses) {
    changed = false;
    pass++;
    
    for (const field of calculatedFields) {
      const newValue = evaluateFormula(field.formula!, workingFields);
      const workingField = workingFields.find(f => f.id === field.id);
      
      if (workingField && workingField.value !== newValue) {
        workingField.value = newValue;
        results.set(field.id, newValue);
        changed = true;
      }
    }
  }
  
  if (pass >= maxPasses) {
    console.warn('Formula calculation: Maximum passes reached. Check for circular dependencies.');
  }
  
  return results;
}