import { SSTConfig } from "sst";
import { NextjsSite } from "sst/constructs";

export default {
  config(_input) {
    return {
      name: "matt-site",
      region: "eu-west-2",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new NextjsSite(stack, "matt-site", {
        edge: true,
        customDomain:
          stack.stage === "prod"
            ? {
                domainName: "mattzcarey.com",
                domainAlias: "www.mattzcarey.com",
              }
            : undefined,
      });

      stack.addOutputs({
        Url: site.customDomainUrl || site.url,
      });
    });
  },
} satisfies SSTConfig;
