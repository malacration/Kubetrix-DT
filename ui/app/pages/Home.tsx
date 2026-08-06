import React from "react";

import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { Flex } from "@dynatrace/strato-components/layouts";
import {
  Heading,
  Text,
} from "@dynatrace/strato-components/typography";

export const Home = () => {
  const theme = useCurrentTheme();
  return (
    <Flex flexDirection="column" alignItems="center" padding={32}>
      <img
        src="./assets/kubetrix_transparent_faces.png"
        alt="Kubetrix DT"
        width={150}
        height={150}
        style={{ paddingBottom: 32 }}
      ></img>

      <Heading level={1}>Bem-vindo ao Kubetrix DT</Heading>
      <Text style={{ opacity: 0.75, marginTop: 4 }}>
        Observabilidade de Kubernetes, bancos de dados e problemas Davis em um só lugar.
      </Text>
    </Flex>
  );
};
