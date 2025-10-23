import React from "react";

import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { Flex } from "@dynatrace/strato-components/layouts";
import {
  Heading,
} from "@dynatrace/strato-components/typography";

export const Home = () => {
  const theme = useCurrentTheme();
  return (
    <Flex flexDirection="column" alignItems="center" padding={32}>
      <img
        src="./assets/kubetrix_transparent_faces.png"
        alt="Dynatrace Logo"
        width={150}
        height={150}
        style={{ paddingBottom: 32 }}
      ></img>

      <Heading>Bem vindo</Heading>
    </Flex>
  );
};
