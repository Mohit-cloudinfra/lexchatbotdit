import { NextRequest, NextResponse } from 'next/server';
import { ConnectClient, StartWebRTCContactCommand } from '@aws-sdk/client-connect';

export async function POST(request) {
  try {
    const body = await request.json();
    const { attributes } = body;

    const client = new ConnectClient({
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2',
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new StartWebRTCContactCommand({
      InstanceId: process.env.NEXT_PUBLIC_CONNECT_INSTANCE_ID || '564ddef5-1ce1-4d8d-abf9-0875eeec654c',
      ContactFlowId: process.env.NEXT_PUBLIC_CONNECT_CONTACT_FLOW_ID || '4a39d555-5bc8-4ffb-b63c-b3a320739d62',
      ParticipantDetails: {
        DisplayName: attributes?.userName || 'Chatbot User',
      },
      Attributes: attributes || {},
    });

    const response = await client.send(command);
    return NextResponse.json({
      success: true,
      connectionData: response.ConnectionData,
      contactId: response.ContactId,
    });
  } catch (error) {
    console.error('StartWebRTCContact error:', error);
    let message = 'Failed to initiate call. Please try again.';
    if (error.name === 'ResourceNotFoundException' || error.message.includes('capacity')) {
      message = 'Agents are full. We will call you back.';
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}