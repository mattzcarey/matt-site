"use client";

import Script from "next/script";

const NewsletterSignup = (): JSX.Element => {
  return (
    <div className="my-8 border-t border-gray-300 pt-8">
      <Script src="https://f.convertkit.com/ckjs/ck.5.js" />

      <p className="text-sm text-muted-foreground mb-4">
        Sign up for (very occasional) updates on new posts.
      </p>

      <form
        action="https://app.kit.com/forms/7428455/subscriptions"
        className="seva-form formkit-form"
        method="post"
        data-sv-form="7428455"
        data-uid="9e350f163a"
        data-format="inline"
        data-version="5"
      >
        <div data-style="clean">
          <ul className="formkit-alert formkit-alert-error" data-element="errors" data-group="alert" />
          <div 
            data-element="fields" 
            data-stacked="false" 
            className="seva-fields formkit-fields flex items-center gap-4"
          >
            <div className="formkit-field flex-1">
              <input
                className="formkit-input w-full"
                aria-label="First Name"
                name="fields[first_name]"
                placeholder="First Name"
                type="text"
              />
            </div>
            <div className="formkit-field flex-1">
              <input
                className="formkit-input w-full"
                name="email_address"
                aria-label="Email Address"
                placeholder="Email Address"
                required
                type="email"
              />
            </div>
            <button
              data-element="submit"
              className="formkit-submit formkit-submit bg-gray-200 dark:bg-gray-800 text-black dark:text-white px-6 py-2 rounded-md hover:bg-gray-500 dark:hover:bg-gray-500 transition-colors whitespace-nowrap"
            >
              <div className="formkit-spinner">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <span>Subscribe</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewsletterSignup;