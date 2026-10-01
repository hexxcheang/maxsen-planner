import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../Field';
import { Input } from '../Input';

describe('Field', () => {
  it('associates label with input', () => {
    render(
      <Field label="Customer name" hint="As it should appear on exports">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Customer name');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAccessibleDescription('As it should appear on exports');
  });

  it('marks the input invalid and announces the error', () => {
    render(
      <Field label="Project title" error="Enter a project title">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Project title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a project title');
  });
});
