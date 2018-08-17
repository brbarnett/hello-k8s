# Hello Kubernetes!
This will serve as a quick guide to get you started on your own managed Kubernetes cluster ([Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/intro-kubernetes)) in Azure. 

## Create an AKS cluster
You'll need the latest Azure CLI. Download here: [https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)

### Log in to Azure CLI
`az login` will return a list of subscription IDs
```
az login
az account set --subscription 00000000-0000-0000-0000-000000000000
```

### Create primary resource group
```
az group create -l centralus -n Kubernetes
```

### Find latest version
Latest is on the bottom of the list. When creating the cluster, use the same location and its corresponding latest version value.
```
az aks get-versions -l centralus
```

### Create AKS cluster
The cluster resource itself will be in the named resource group, but it will also automatically create a managed cluster resource group that will contain all of the resources to support the node VMs. The name is auto-created in the format of MC_[Resource Group]\_[AKS Cluster Name]\_[Location], so in this example it will be MC_Kubernetes_rp-aks-centralus_centralus

AAD integration is optional, but it does make it significantly easier to provision access to other users in your organization. If you don't want to use it here, drop the `--aad-*` flags from the create command. Otherwise, follow this guide for instructions on AAD integration: [https://docs.microsoft.com/en-us/azure/aks/aad-integration](https://docs.microsoft.com/en-us/azure/aks/aad-integration)
```
az aks create `
    -g Kubernetes `
    -n rp-aks-centralus `
    -l centralus `
    -c 3 `
    -s Standard_DS1_v2 `
    --aad-server-app-id 00000000-0000-0000-0000-000000000000 `
    --aad-server-app-secret xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx= `
    --aad-client-app-id 00000000-0000-0000-0000-000000000000 `
    --aad-tenant-id 00000000-0000-0000-0000-000000000000 `
    --enable-rbac `
    --kubernetes-version 1.11.1 `
    --no-wait
```
_Note: backticks (`) are for legibility and I'm assuming you're using PowerShell. Use backslashes instead on Linux._

### Install `kubectl`
`kubectl` is Kubernetes' CLI tool that allows you to interact with your cluster.
```
az aks install-cli --client-version latest
```

### Get cluster credentials
This will merge credentials into your local `kubectl` context. The `-a` flag is for admin login.
```
az aks get-credentials -g Kubernetes -n rp-aks-centralus -a
```

### Check that the nodes are ready and that the Kubernetes system pods are running
```
kubectl get nodes -o wide
kubectl get pods --all-namespaces -o wide
```

### Delete the `kubernetes-dashboard` resources 
Its access level is considered an attack vector. It is unlikely to be deployed by default in later versions of AKS.
```
kubectl delete deployment kubernetes-dashboard -n kube-system
kubectl delete service kubernetes-dashboard -n kube-system
kubectl delete secret kubernetes-dashboard-key-holder -n kube-system
```

## Install the example-voting-app Docker sample
The voting app is the cannonical Docker and Docker-Compose example. 

Source: [https://github.com/dockersamples/example-voting-app](https://github.com/dockersamples/example-voting-app)

### Install Kubernetes resources with `kubectl`
This will also create a `namespace` that will contain all of the voting app resources. Namespaces are isolated (e.g., RBAC, DNS) and can be deleted as a single unit. In this way, they are analogous to Azure Resource Groups.
```
kubectl create namespace voting-app
kubectl apply -f .\example-voting-app\ -n voting-app
kubectl get services -n voting-app
```

Take the EXTERNAL-IP values from the `vote` and `result` services and access the apps via the following URIs:

- vote: http://{vote-EXTERNAL-IP}:5000
- result: http://{result-EXTERNAL-IP}:5001

## Working with `Ingress` resources
The Kubernetes `Ingress` resource is a configuration file that manages reverse proxy rules for inbound cluster traffic. This allows you to surface multiple services as if they were a combined API.

Ingress requires a public, static IP. Start by provisioning one:
```
az network public-ip create `
    -g MC_kubernetes_rp-aks-centralus_centralus `
    -n rp-aks-centralus-api-ingress-ip `
    -l centralus `
    --allocation-method static `
    --dns-name rp-aks-centralus-api-ingress    
```

Remember -- Ingress is simply a configuration file. It still requires an ingress controller to serve as its reverse proxy. Kubernetes has provided a Helm chart as an implementation of an ingress controller.

_Note: Please [install Helm](#helm) prior to running this command_
```
kubectl create namespace api-ingress

helm install stable/nginx-ingress `
    --name nginx-ingress `
    --namespace api-ingress `
    --set controller.service.loadBalancerIP=40.113.202.183 `
    --set controller.scope.enabled=true `
    --set controller.scope.namespace="api-ingress" `
    --set controller.replicaCount=3

kubectl get service nginx-ingress-controller -n api-ingress -w
```

In final preperation, we will set up TLS termination via LetsEncrypt
```
helm install stable/cert-manager `
    --name cert-manager `
    --namespace kube-system `
    --set ingressShim.extraArgs='{--default-issuer-name=letsencrypt-prod,--default-issuer-kind=Issuer}'

kubectl apply -f .\setup\cert-issuer-prod.yaml -n api-ingress
```

Now, create some resources and an `Ingress` definition:
```
kubectl apply -f .\example-ingress\kubernetes\ -n api-ingress
```

Access the two services, balanced between their deployed pods, with these URIs:

- [http://rp-aks-centralus-api-ingress.centralus.cloudapp.azure.com/api-a](http://rp-aks-centralus-api-ingress.centralus.cloudapp.azure.com/api-a)
- [http://rp-aks-centralus-api-ingress.centralus.cloudapp.azure.com/api-b](http://rp-aks-centralus-api-ingress.centralus.cloudapp.azure.com/api-b)

## Advanced concepts

### Helm
[Helm](https://helm.sh/) is a Kubernetes package manager that installs bundles of Kubernetes resources called Charts. 

Helm consists of a client CLI on the operator's machine that sends command to an agent pod (called `Tiller`) on a Kubernetes cluster. When RBAC is enabled, `Tiller` needs a service account to have enough privileges to manage resources.

Start by creating a service account
```
kubectl apply -f .\setup\helm-service-account.yaml
```

Now initialize Helm on your cluster
```
helm init --service-account tiller
helm version
```
_Note: in a production cluster, you should be using specific RBAC Roles and RoleBindings to specify Tiller's access to the cluster. See Helm's documentation on how to secure your installation: [https://docs.helm.sh/using_helm/#securing-your-helm-installation](https://docs.helm.sh/using_helm/#securing-your-helm-installation)_

### Istio
[Istio](https://istio.io) is an implementation of a service mesh. It automatically injects Envoy proxies as sidecars into application pods that provide capabilities such as:

1. Client-side service discovery and DNS
2. Network policies
3. Telemetry collection
4. Advanced load balancing (e.g., canary releases)
5. Fault injection (i.e., chaos testing)
6. Implements timeout, circuit breaker, retry

This is based on Istio's installation documentation: [https://istio.io/docs/setup/kubernetes/helm-install/](https://istio.io/docs/setup/kubernetes/helm-install/)

Start by cloning the Istio project
```
git clone https://github.com/istio/istio
cd istio
```

Istio comes with a good number of `CustomRoleDefinition` resources, or CRDs. Before installing Istio via Helm, load these CRDs manually (future version of Helm will allow CRD + Chart installations)
```
kubectl apply -f install/kubernetes/helm/istio/templates/crds.yaml
```

Now install Istio with some custom values
```
helm install install/kubernetes/helm/istio `
    --name istio `
    --namespace istio-system `
    --set global.controlPlaneSecurityEnabled=true `
    --set global.mtls.enabled=true `
    --set grafana.enabled=true `
    --set grafana.persist=true `
    --set servicegraph.enabled=true `
    --set tracing.enabled=true `
    --timeout 600

kubectl get pods -n istio-system
```
_Note: see all possible custom values here: [https://github.com/istio/istio/tree/master/install/kubernetes/helm/istio#configuration](https://github.com/istio/istio/tree/master/install/kubernetes/helm/istio#configuration)