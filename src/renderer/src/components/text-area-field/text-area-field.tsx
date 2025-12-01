import React, { useId, useState } from "react";
import cn from "classnames";

export interface TextAreaFieldProps
  extends React.DetailedHTMLProps<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    HTMLTextAreaElement
  > {
  theme?: "primary" | "dark";
  label?: string | React.ReactNode;
  hint?: string | React.ReactNode;
  textAreaProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
  rightContent?: React.ReactNode | null;
  error?: string | React.ReactNode;
}

export const TextAreaField = React.forwardRef<
  HTMLTextAreaElement,
  TextAreaFieldProps
>(
  (
    {
      theme = "primary",
      label,
      hint,
      textAreaProps,
      containerProps,
      rightContent = null,
      error,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const id = useId();
    const [isFocused, setIsFocused] = useState(false);

    const hintContent = error ? (
      <small className="text-field-container__error-label">{error}</small>
    ) : hint ? (
      <small>{hint}</small>
    ) : null;

    const hasError = !!error;

    return (
      <div className="text-field-container" {...containerProps}>
        {label && <label htmlFor={id}>{label}</label>}
        <div className="text-field-container__text-field-wrapper">
          <div
            className={cn(
              "text-field-container__text-field",
              `text-field-container__text-field--${theme}`,
              {
                "text-field-container__text-field--has-error": hasError,
                "text-field-container__text-field--focused": isFocused,
              }
            )}
            style={{ minHeight: 96, height: "auto" }}
            {...textAreaProps}
          >
            <textarea
              ref={ref}
              id={id}
              className={cn("text-field-container__text-field-input")}
              rows={rows}
              {...props}
              onFocus={(e) => {
                setIsFocused(true);
                props.onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                props.onBlur?.(e);
              }}
            />
          </div>
          {rightContent}
        </div>
        {hintContent}
      </div>
    );
  }
);

TextAreaField.displayName = "TextAreaField";
