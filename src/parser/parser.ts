import { Lexer } from "../lexer/lexer";
import { Token, TokenEnum, HashSet } from "../token/token";
import { 
    Program, 
    Statement, 
    LetStatement, 
    Identifier, 
    ReturnStatement, 
    Expression, 
    ExpressionStatement, 
    IntegerLiteral,
    PrefixExpression
} from "../ast/ast";
import { AssertionError } from "assert";

type PrefixParseFn = (p: Parser) => Expression;
type InfixParseFn = (p: Parser, e: Expression) => Expression;

enum PrecedenceEnum {
    LOWEST,
    EQUALS,
    LESSGREATER,
    SUM,
    PRODUCT,
    PREFIX,
    CALL
}

export class Parser {
    lexer: Lexer;
    curToken: Token;
    peekToken: Token;
    errors: string[] = [];
    prefixParseFns: HashSet<PrefixParseFn> = {};
    infixParseFns: HashSet<InfixParseFn> = {};

    constructor(lexer: Lexer) {
        this.lexer = lexer;

        this.registerPrefix(TokenEnum.IDENT, this.parseIdentifier);
        this.registerPrefix(TokenEnum.INT, this.parseIntegerLiteral);
        this.registerPrefix(TokenEnum.BANG, this.parsePrefixExpression);
        this.registerPrefix(TokenEnum.MINUS, this.parsePrefixExpression);

        this.nextToken();
        this.nextToken();
    }

    nextToken(): void {
        this.curToken = this.peekToken;
        this.peekToken = this.lexer.nextToken();
    }

    parseProgram(): Program {
        const program: Program = new Program();
        
        while (this.curToken.Type != TokenEnum.EOF) {
            const stmt = this.parseStatement();
            if (stmt !== null) {
                program.statements.push(stmt);
            }
            this.nextToken();
        }

        return program;
    }

    parseStatement(): Statement {
        switch (this.curToken.Type) {
            case TokenEnum.LET:
                return this.parseLetStatement();
            case TokenEnum.RETURN:
                return this.parseReturnStatement();    
            default:
                return this.parseExpressionStatement();
        }
    }

    parseLetStatement(): LetStatement {
        const stmt = new LetStatement();
        stmt.token = this.curToken;

        if (!this.expectPeek(TokenEnum.IDENT)) {
            return null;
        }

        stmt.name = new Identifier(this.curToken, this.curToken.Literal);

        if (!this.expectPeek(TokenEnum.ASSIGN)) {
            return null;
        }

        while (!this.curTokenIs(TokenEnum.SEMICOLON)) {
            this.nextToken();
        }

        return stmt;
    }

    parseReturnStatement(): ReturnStatement {
        const stmt = new ReturnStatement(this.curToken);

        this.nextToken();

        while (!this.curTokenIs(TokenEnum.SEMICOLON)) {
            this.nextToken();
        }

        return stmt;
    }

    parseExpressionStatement(): ExpressionStatement {
        const stmt = new ExpressionStatement();
        stmt.token = this.curToken;
        stmt.expression = this.parseExpression(PrecedenceEnum.LOWEST);

        if (this.peekTokenIs(TokenEnum.SEMICOLON)) {
            this.nextToken();
        }

        return stmt;
    }

    parseExpression(precedence: PrecedenceEnum): Expression {
        const prefix = this.prefixParseFns[this.curToken.Type];
        if (prefix == null) {
            this.noPrefixParseFnError(this.curToken.Type);
            return null;
        }
        const leftExp = prefix(this);

        return leftExp;
    }

    parseIntegerLiteral(p: Parser): Expression {
        const lit = new IntegerLiteral();
        lit.token = p.curToken;
        lit.value = parseInt(p.curToken.Literal);

        return lit;
    }

    parseIdentifier(p: Parser): Expression {
        return new Identifier(p.curToken, p.curToken.Literal);
    }

    parsePrefixExpression(p: Parser): Expression {
        const expression = new PrefixExpression();
        expression.token = p.curToken;
        expression.operator = p.curToken.Literal;

        p.nextToken();

        expression.right = p.parseExpression(PrecedenceEnum.PREFIX);

        return expression;
    }

    // helpers

    curTokenIs(t: TokenEnum): boolean {
        return this.curToken.Type == t;
    }

    peekTokenIs(t: TokenEnum): boolean {
        return this.peekToken.Type == t;
    }

    expectPeek(t: TokenEnum): boolean {
        if (this.peekTokenIs(t)) {
            this.nextToken();
            return true;
        } else {
            this.peekError(t);
            return false;
        }
    }

    peekError(t: TokenEnum) {
        const msg = `expected next token to be ${t}, got ${this.peekToken.Type} instead`;
        this.errors.push(msg);
    }

    registerPrefix(tokenType: TokenEnum, fn: PrefixParseFn): void {
        this.prefixParseFns[tokenType] = fn;
    }

    registerInfix(tokenType: TokenEnum, fn: InfixParseFn): void {
        this.infixParseFns[tokenType] = fn;
    }

    noPrefixParseFnError(t: TokenEnum): void {
        const msg = `no prefix parse function for ${t} found`;
        this.errors.push(msg);
    }
}