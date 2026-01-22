import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'default' | 'sm' | 'icon';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'default', isLoading, children, disabled, ...props }, ref) => {
        const variants = {
            primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg sm:shadow-blue-500/20",
            secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
            ghost: "hover:bg-slate-800 text-slate-400 hover:text-slate-100",
            danger: "bg-red-600 hover:bg-red-700 text-white"
        };

        const sizes = {
            default: "h-10 px-4 py-2",
            sm: "h-8 px-3 text-xs",
            icon: "h-10 w-10 p-0"
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    "flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-100 transition-all",
                    className
                )}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => {
        return (
            <label
                ref={ref}
                className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300 mb-2 block", className)}
                {...props}
            />
        );
    }
);
Label.displayName = "Label";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    "flex min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-100 transition-all resize-y",
                    className
                )}
                {...props}
            />
        );
    }
);
Textarea.displayName = "Textarea";
