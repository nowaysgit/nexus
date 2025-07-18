import { Sanitize, TrimAndSanitize } from '../../../src/common/decorators/sanitize.decorator';
import { plainToClass, Transform } from 'class-transformer';

describe('Sanitize Decorators', () => {
  describe('Sanitize decorator', () => {
    class TestClass {
      @Sanitize()
      message: string;

      @Sanitize()
      optionalField?: string;

      normalField: string;
    }

    it('should sanitize HTML tags', () => {
      const input = { message: '<script>alert("xss")</script>' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should sanitize quotes', () => {
      const input = { message: 'Hello "world" and \'friend\'' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('Hello &quot;world&quot; and &#39;friend&#39;');
    });

    it('should sanitize backticks', () => {
      const input = { message: 'Template `literal` here' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('Template &#96;literal&#96; here');
    });

    it('should sanitize backslashes', () => {
      const input = { message: 'Path\\to\\file' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('Path\\\\to\\\\file');
    });

    it('should handle complex XSS attempts', () => {
      const input = { message: '<img src="x" onerror="alert(\'XSS\')">' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(
        '&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;',
      );
    });

    it('should not affect non-string values', () => {
      const input = { message: 123 };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(123);
    });

    it('should handle null values', () => {
      const input = { message: null };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(null);
    });

    it('should handle undefined values', () => {
      const input = { message: undefined };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(undefined);
    });

    it('should handle empty strings', () => {
      const input = { message: '' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('');
    });

    it('should not affect fields without decorator', () => {
      const input = { normalField: '<script>alert("test")</script>' };
      const result = plainToClass(TestClass, input);

      expect(result.normalField).toBe('<script>alert("test")</script>');
    });
  });

  describe('TrimAndSanitize decorator', () => {
    class TestClass {
      @TrimAndSanitize()
      message: string;

      @TrimAndSanitize()
      optionalField?: string;
    }

    it('should trim whitespace and sanitize', () => {
      const input = { message: '  <script>alert("xss")</script>  ' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should trim leading and trailing spaces', () => {
      const input = { message: '   hello world   ' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('hello world');
    });

    it('should trim tabs and newlines', () => {
      const input = { message: '\t\n  hello world  \n\t' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('hello world');
    });

    it('should sanitize after trimming', () => {
      const input = { message: '  <div>Hello "world"</div>  ' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('&lt;div&gt;Hello &quot;world&quot;&lt;/div&gt;');
    });

    it('should handle strings that become empty after trimming', () => {
      const input = { message: '   \t\n   ' };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe('');
    });

    it('should not affect non-string values', () => {
      const input = { message: 42 };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(42);
    });

    it('should handle null values', () => {
      const input = { message: null };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(null);
    });

    it('should handle undefined values', () => {
      const input = { message: undefined };
      const result = plainToClass(TestClass, input);

      expect(result.message).toBe(undefined);
    });
  });

  describe('combined usage scenarios', () => {
    class CombinedTestClass {
      @Sanitize()
      sanitizedField: string;

      @TrimAndSanitize()
      trimmedAndSanitizedField: string;

      normalField: string;
    }

    it('should apply different decorators to different fields', () => {
      const input = {
        sanitizedField: '<script>alert("test")</script>',
        trimmedAndSanitizedField: '  <div>Hello</div>  ',
        normalField: '<span>Normal</span>',
      };

      const result = plainToClass(CombinedTestClass, input);

      expect(result.sanitizedField).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
      expect(result.trimmedAndSanitizedField).toBe('&lt;div&gt;Hello&lt;/div&gt;');
      expect(result.normalField).toBe('<span>Normal</span>');
    });

    it('should handle mixed data types', () => {
      const input = {
        sanitizedField: 123,
        trimmedAndSanitizedField: '  text  ',
        normalField: null,
      };

      const result = plainToClass(CombinedTestClass, input);

      expect(result.sanitizedField).toBe(123);
      expect(result.trimmedAndSanitizedField).toBe('text');
      expect(result.normalField).toBe(null);
    });
  });

  describe('edge cases', () => {
    class EdgeCaseClass {
      @Sanitize()
      field: string;
    }

    it('should handle strings with only special characters', () => {
      const input = { field: '<>&"\'\`\\' };
      const result = plainToClass(EdgeCaseClass, input);

      expect(result.field).toBe('&lt;&gt;&&quot;&#39;&#96;\\\\');
    });

    it('should handle very long strings', () => {
      const longString = '<script>' + 'a'.repeat(10000) + '</script>';
      const input = { field: longString };
      const result = plainToClass(EdgeCaseClass, input);

      expect(result.field).toContain('&lt;script&gt;');
      expect(result.field).toContain('&lt;/script&gt;');
      expect(result.field.length).toBeGreaterThan(longString.length);
    });

    it('should handle unicode characters', () => {
      const input = { field: 'Hello 世界 🌍 <script>' };
      const result = plainToClass(EdgeCaseClass, input);

      expect(result.field).toBe('Hello 世界 🌍 &lt;script&gt;');
    });

    it('should handle already encoded entities', () => {
      const input = { field: '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;' };
      const result = plainToClass(EdgeCaseClass, input);

      expect(result.field).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
    });
  });
});
