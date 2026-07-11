import { graphqlRequest } from "../src/lib/nhost/graphql";

(async () => {
  const q = `query {
    action_features(where: {has_specific_screen: {_eq: true}}, order_by: {sort_order: asc}) {
      id name code has_specific_screen has_control has_issue has_review has_approve
    }
  }`;
  const d = await graphqlRequest<{ action_features: any[] }>(q);
  console.log("=== ACTION FEATURES CON PANTALLA ESPECÍFICA ===");
  for (const f of d.action_features) {
    console.log(`- ${f.name} (code: ${f.code}) — issue:${f.has_issue} review:${f.has_review} approve:${f.has_approve}`);
  }
})();
