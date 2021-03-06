import {
    SecretLintRuleLocaleTag,
    SecretLintRuleLocalizeMessageMulti,
    SecretLintRuleLocalizeMessages,
    SecretLintRuleMessageTranslateData,
    SecretLintRuleTranslatorResult,
} from "@secretlint/types";

const escapeStringRegexp = require("escape-string-regexp");
/**
 * Default locale that is also fallback locale.
 */
const DEFAULT_LOCAL = "en";

const assertPlaceholder = (message: string, data?: {}) => {
    const unMatchedPlaceholder = /{{([^}]+)}}/g;
    const placeholderNames: string[] = [];
    const keyNames: string[] = data ? Object.keys(data) : [];
    let match;
    while ((match = unMatchedPlaceholder.exec(message)) !== null) {
        const matchString = match[1] || "";
        placeholderNames.push(matchString);
    }
    const missingKeys = placeholderNames.filter((name) => {
        return !keyNames.includes(name);
    });
    if (missingKeys.length > 0) {
        throw new Error(`[Rule Creator Error] Placeholder:{{${missingKeys.join("}} ,{{")}}} still existed.

Probably, message's data is missing.
`);
    }
};
const formatMessage = (message: string, data?: {}): string => {
    assertPlaceholder(message, data);
    if (typeof data !== "object" || data === null) {
        return message;
    }
    let output = message;
    Object.entries(data).forEach(([key, value]) => {
        output = output.replace(new RegExp(escapeStringRegexp(`{{${key}}}`), "g"), String(value));
    });
    return output;
};

const getMatchedLocaleMessage = (locale: SecretLintRuleLocaleTag, locales: SecretLintRuleLocalizeMessageMulti) => {
    const localKeys = Object.keys(locales);
    const matchLocale = localKeys.find((key) => {
        return key === locale;
    });
    if (matchLocale) {
        return matchLocale;
    }
    const [lang] = locale.split("-");
    if (!lang) {
        return DEFAULT_LOCAL;
    }
    // en-US => en
    const fallbackMatchLocal = localKeys.find((key) => {
        return key === lang;
    });
    if (fallbackMatchLocal) {
        return fallbackMatchLocal;
    }
    return DEFAULT_LOCAL;
};

export const createTranslator = <T extends SecretLintRuleLocalizeMessages>(
    messages: T,
    options: {
        defaultLocale: SecretLintRuleLocaleTag;
    }
) => {
    return <Data extends SecretLintRuleMessageTranslateData>(
        messageId: keyof T,
        data?: Data
    ): SecretLintRuleTranslatorResult<Data> => {
        const messageObject: SecretLintRuleLocalizeMessageMulti | string | undefined = messages[messageId];
        if (!messageObject) {
            throw new Error(`messages:${messageId} is missing in messages.`);
        }
        // if messages is string, use it.
        if (typeof messageObject === "string") {
            if (typeof messageId !== "string") {
                throw new Error(`message's key:${messageId} should be string`);
            }
            return {
                message: formatMessage(messageObject, data),
                messageId: messageId,
                data,
            };
        }
        // if messages is object, pick message that is matched locale from messages.
        const defaultLocal = options && options.defaultLocale ? options.defaultLocale : DEFAULT_LOCAL;
        const locale = getMatchedLocaleMessage(defaultLocal, messageObject);
        const localizedMessage = messageObject[locale];
        if (!localizedMessage) {
            if (messageObject[DEFAULT_LOCAL]) {
                throw new Error(`messages${messageId}.${locale} is missing in messages.`);
            }
            throw new Error(`message's key:${messageId}.${DEFAULT_LOCAL} should be defined in messages.`);
        }
        if (typeof messageId !== "string") {
            throw new Error(`message's key:${messageId}.${DEFAULT_LOCAL} should be string`);
        }
        return {
            message: formatMessage(localizedMessage, data),
            messageId: messageId,
            data,
        };
    };
};
