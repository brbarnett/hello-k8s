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
    --enable-addons http_application_routing `
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
kubectl delete secret kubernetes-dashboard-token-8bv4h -n kube-system
```