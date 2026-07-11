import { graphqlRequest } from "../src/lib/nhost/graphql";

(async () => {
  const q = `query {
    claim_actions(limit: 3, order_by: { created_on: desc }) {
      id
      name
      claim_id
      action_status { code name }
      action_feature { name has_specific_screen }
    }
  }`;
  const d = await graphqlRequest<{ claim_actions: any[] }>(q);
  if (d.claim_actions.length === 0) {
    console.log("No hay claim_actions en la base");
  } else {
    for (const a of d.claim_actions) {
      console.log(`- ${a.name} | claim: ${a.claim_id} | status: ${a.action_status?.code} | screen: ${a.action_feature?.has_specific_screen}`);
      console.log(`  URL: /dashboard/claims/${a.claim_id}/gestiones/${a.id}`);
    }
  }
})();
