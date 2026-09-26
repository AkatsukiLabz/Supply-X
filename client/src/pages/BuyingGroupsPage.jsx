import React from "react";
import BuyingGroups from "../components/BuyingGroups.jsx";

export default function BuyingGroupsPage({ groups, busy, act }) {
  return (
    <BuyingGroups
      groups={groups}
      busy={busy}
      onRefresh={() => act(async () => {}, "Buying groups updated.")}
    />
  );
}
