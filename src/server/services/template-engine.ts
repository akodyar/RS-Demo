import { NotificationCategory } from '../../types/communications-crm.js';

export interface RenderedTemplate {
  title: string;
  body: string;
  language: 'ku' | 'ar' | 'en';
  isRtl: boolean;
}

export class TemplateEngine {
  // Safe HTML / text escaping
  escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Wrap technical identifiers, phone numbers, currencies, dates in LTR isolation
  isolateLtr(text: string): string {
    // Both HTML span dir="ltr" and Unicode LRE (U+202A) / PDF (U+202C)
    return `\u202A${text}\u202C`;
  }

  // Validate URL to ensure it is from a trusted origin and never a javascript: / data: scheme
  validateSafeUrl(url: string, trustedOrigins: string[] = ['https://homehub.iq', 'http://localhost:3000', 'http://localhost:5173']): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Explicitly reject harmful schemes
    const lower = url.trim().toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      return false;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      return trustedOrigins.some(origin => parsed.origin === origin);
    } catch {
      // Relative URLs starting with '/' are permitted if they don't start with '//' (protocol-relative)
      if (url.startsWith('/') && !url.startsWith('//')) {
        return true;
      }
      return false;
    }
  }

  // Render a template securely without eval / Function / dynamic execution
  render(
    titleTemplate: string,
    bodyTemplate: string,
    variables: Record<string, any>,
    allowedVariables: string[],
    language: 'ku' | 'ar' | 'en' = 'ku'
  ): RenderedTemplate {
    const isRtl = language === 'ku' || language === 'ar';

    // Filter variables to allowedVariables only
    const safeVars: Record<string, string> = {};
    for (const key of allowedVariables) {
      if (key in variables) {
        let val = variables[key];
        if (val === undefined || val === null) {
          val = '';
        } else if (typeof val === 'number') {
          val = this.isolateLtr(String(val));
        } else if (typeof val === 'string') {
          // If value looks like an ID, phone (+964), currency amount, or URL, isolate LTR
          if (/^(\+964|07\d|UUID|uuid|usr_|prop_|notif_|tx_|IQD|USD|\$)/.test(val)) {
            val = this.isolateLtr(this.escapeHtml(val));
          } else {
            val = this.escapeHtml(val);
          }
        } else {
          val = this.escapeHtml(JSON.stringify(val));
        }
        safeVars[key] = val;
      }
    }

    // Replace {{variable}} deterministically
    const replacePattern = /\{\{([a-zA-Z0-9_]+)\}\}/g;

    const renderText = (tmpl: string) => {
      return tmpl.replace(replacePattern, (match, varName) => {
        if (allowedVariables.includes(varName) && varName in safeVars) {
          return safeVars[varName];
        }
        // If variable not in allowedVariables or not provided, safely remove or leave empty
        return '';
      });
    };

    return {
      title: renderText(titleTemplate),
      body: renderText(bodyTemplate),
      language,
      isRtl
    };
  }

  // Pre-approved built-in templates
  getStandardTemplate(code: string, language: 'ku' | 'ar' | 'en'): {
    titleTemplate: string;
    bodyTemplate: string;
    allowedVariables: string[];
    category: NotificationCategory;
  } | null {
    const templates: Record<string, Record<string, { title: string; body: string; vars: string[]; category: NotificationCategory }>> = {
      RENT_DUE_NOTICE: {
        ku: {
          title: 'ئاگاداری وادەی کرێ: {{propertyTitle}}',
          body: 'کرێی مانگانە بە بڕی {{amount}} لە بەرواری {{dueDate}} دەبێتە واجیب.',
          vars: ['propertyTitle', 'amount', 'dueDate'],
          category: 'RENT'
        },
        ar: {
          title: 'إشعار استحقاق الإيجار: {{propertyTitle}}',
          body: 'الإيجار الشهري بمبلغ {{amount}} يستحق في تاريخ {{dueDate}}.',
          vars: ['propertyTitle', 'amount', 'dueDate'],
          category: 'RENT'
        },
        en: {
          title: 'Rent Due Notice: {{propertyTitle}}',
          body: 'Monthly rent of {{amount}} is due on {{dueDate}}.',
          vars: ['propertyTitle', 'amount', 'dueDate'],
          category: 'RENT'
        }
      },
      PAYMENT_RECEIPT: {
        ku: {
          title: 'پسوولەی وەرگرتنی پارە: {{receiptNumber}}',
          body: 'پارەدان بە بڕی {{amount}} بۆ {{propertyTitle}} بە سەرکەوتوویی تۆمارکرا.',
          vars: ['receiptNumber', 'amount', 'propertyTitle', 'date'],
          category: 'PAYMENT'
        },
        ar: {
          title: 'إيصال دفع: {{receiptNumber}}',
          body: 'تم استلام الدفعة بمبلغ {{amount}} بنجاح للعقار {{propertyTitle}}.',
          vars: ['receiptNumber', 'amount', 'propertyTitle', 'date'],
          category: 'PAYMENT'
        },
        en: {
          title: 'Payment Receipt: {{receiptNumber}}',
          body: 'Payment of {{amount}} for {{propertyTitle}} has been received.',
          vars: ['receiptNumber', 'amount', 'propertyTitle', 'date'],
          category: 'PAYMENT'
        }
      },
      SECURITY_ALERT: {
        ku: {
          title: 'ئاگاداری ئاسایش: چالاکی نوێی هەژمار',
          body: 'چوونەژوورەوەی نوێ لە ئامێری {{device}} تۆمارکرا لە {{time}}.',
          vars: ['device', 'time', 'ip'],
          category: 'SECURITY'
        },
        ar: {
          title: 'تنبيه أمان: نشاط جديد في الحساب',
          body: 'تم تسجيل دخول جديد من جهاز {{device}} في {{time}}.',
          vars: ['device', 'time', 'ip'],
          category: 'SECURITY'
        },
        en: {
          title: 'Security Alert: New Account Activity',
          body: 'New sign-in detected on device {{device}} at {{time}}.',
          vars: ['device', 'time', 'ip'],
          category: 'SECURITY'
        }
      },
      MAINTENANCE_UPDATE: {
        ku: {
          title: 'نوێکردنەوەی چاککردنەوە: {{ticketTitle}}',
          body: 'داواکاری چاککردنەوە گۆڕدرا بۆ باری: {{status}}.',
          vars: ['ticketTitle', 'status', 'vendorName'],
          category: 'MAINTENANCE'
        },
        ar: {
          title: 'تحديث الصيانة: {{ticketTitle}}',
          body: 'تم تغيير حالة طلب الصيانة إلى: {{status}}.',
          vars: ['ticketTitle', 'status', 'vendorName'],
          category: 'MAINTENANCE'
        },
        en: {
          title: 'Maintenance Update: {{ticketTitle}}',
          body: 'Maintenance request status changed to: {{status}}.',
          vars: ['ticketTitle', 'status', 'vendorName'],
          category: 'MAINTENANCE'
        }
      },
      DISPUTE_UPDATE: {
        ku: {
          title: 'نوێکردنەوەی ناکۆکی: {{disputeNumber}}',
          body: 'ڕووداوی نوێ لە پەڕەی ناکۆکیدا تۆمارکرا: {{summary}}.',
          vars: ['disputeNumber', 'summary'],
          category: 'DISPUTE'
        },
        ar: {
          title: 'تحديث النزاع: {{disputeNumber}}',
          body: 'تم تسجيل حدث جديد في ملف النزاع: {{summary}}.',
          vars: ['disputeNumber', 'summary'],
          category: 'DISPUTE'
        },
        en: {
          title: 'Dispute Update: {{disputeNumber}}',
          body: 'A new event was recorded for dispute {{disputeNumber}}: {{summary}}.',
          vars: ['disputeNumber', 'summary'],
          category: 'DISPUTE'
        }
      }
    };

    const entry = templates[code]?.[language] || templates[code]?.['ku'];
    if (!entry) return null;

    return {
      titleTemplate: entry.title,
      bodyTemplate: entry.body,
      allowedVariables: entry.vars,
      category: entry.category
    };
  }
}

export const templateEngine = new TemplateEngine();
