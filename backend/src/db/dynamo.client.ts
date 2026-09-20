import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { env } from '../config/env';

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'tienda-donapaty-table-production';

const getCredentials = () => {
  if (process.env.DYNAMODB_ACCESS_KEY_ID && process.env.DYNAMODB_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.DYNAMODB_ACCESS_KEY_ID,
      secretAccessKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
    };
  }
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.NODE_ENV !== 'production') {
    try {
      return fromIni({ profile: process.env.AWS_PROFILE || 'terra-profile' });
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const credentials = getCredentials();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || env.AWS_REGION || 'us-east-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
  ...(credentials && { credentials }),
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});
