import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
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
        edge: false,
        customDomain:
          stack.stage === "prod"
            ? {
                domainName: "mattzcarey.com",
                domainAlias: "www.mattzcarey.com",
                cdk: {
                  certificate: Certificate.fromCertificateArn(
                    stack,
                    "Certificate",
                    "arn:aws:acm:us-east-1:992382376907:certificate/9150347e-b2f9-4c80-b7b3-b8ae1daffd95"
                  ),
                },
              }
            : undefined,
      });

      stack.addOutputs({
        Url: site.customDomainUrl || site.url,
      });
    });
  },
} satisfies SSTConfig;
